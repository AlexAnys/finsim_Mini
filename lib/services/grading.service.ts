import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import * as aiService from "./ai.service";
import { updateSubmissionGrade } from "./submission.service";
import { logAudit } from "./audit.service";

// ============================================
// 统一批改入口
// ============================================

export const LATE_SUBMISSION_PENALTY_RATE = 0.2;

export interface LatePenaltyResult {
  applied: boolean;
  score: number;
  originalScore: number;
  penaltyAmount: number;
  rate: number;
}

export function computeLatePenalty(input: {
  score: number;
  maxScore: number;
  dueAt?: Date | string | null;
  submittedAt?: Date | string | null;
}): LatePenaltyResult {
  const originalScore = clampScore(input.score, input.maxScore);
  const dueAt = input.dueAt ? new Date(input.dueAt).getTime() : null;
  const submittedAt = input.submittedAt ? new Date(input.submittedAt).getTime() : null;
  const shouldApply =
    dueAt != null &&
    submittedAt != null &&
    Number.isFinite(dueAt) &&
    Number.isFinite(submittedAt) &&
    submittedAt > dueAt &&
    originalScore > 0;

  if (!shouldApply) {
    return {
      applied: false,
      score: originalScore,
      originalScore,
      penaltyAmount: 0,
      rate: LATE_SUBMISSION_PENALTY_RATE,
    };
  }

  const penaltyAmount = roundScore(originalScore * LATE_SUBMISSION_PENALTY_RATE);
  return {
    applied: true,
    score: clampScore(roundScore(originalScore - penaltyAmount), input.maxScore),
    originalScore,
    penaltyAmount,
    rate: LATE_SUBMISSION_PENALTY_RATE,
  };
}

function clampScore(score: number, maxScore: number) {
  if (!Number.isFinite(score)) return 0;
  const upper = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : score;
  return Math.min(Math.max(roundScore(score), 0), upper);
}

function roundScore(score: number) {
  return Math.round(score * 100) / 100;
}

function latePenaltyMetadata(penalty: LatePenaltyResult) {
  return {
    applied: penalty.applied,
    rate: penalty.rate,
    originalScore: penalty.originalScore,
    penaltyAmount: penalty.penaltyAmount,
    adjustedScore: penalty.score,
    label: "迟交扣分 20%",
  };
}

function appendLatePenaltyFeedback(
  feedback: string | null | undefined,
  penalty: LatePenaltyResult,
) {
  if (!penalty.applied) return feedback || "";
  const prefix = feedback ? `${feedback}\n` : "";
  return `${prefix}已应用迟交扣分 20%，原始得分 ${penalty.originalScore}，扣除 ${penalty.penaltyAmount} 分，最终得分 ${penalty.score}。`;
}

/**
 * PR-SIM-1a D1: AI 批改完成时计算 releasedAt
 *
 * 行为：
 * - releaseMode === "auto" + autoReleaseAt 已到期（<= NOW）→ releasedAt = NOW（立即公布）
 * - releaseMode === "auto" + autoReleaseAt 未到 → releasedAt = null（等 cron 自动公布）
 * - releaseMode === "auto" + autoReleaseAt 为 null → releasedAt = NOW（auto 但教师没设时点 = 立即公布）
 * - releaseMode === "manual" → releasedAt = null（教师手动公布）
 * - 没有 taskInstance（独立任务）→ releasedAt = null（manual 默认行为）
 */
export function computeReleasedAtForGrading(args: {
  releaseMode: "auto" | "manual" | null | undefined;
  autoReleaseAt: Date | null | undefined;
  now?: Date;
}): Date | null {
  const now = args.now ?? new Date();
  if (args.releaseMode !== "auto") return null;
  if (!args.autoReleaseAt) return now;
  return args.autoReleaseAt.getTime() <= now.getTime() ? now : null;
}

export async function gradeSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      task: {
        include: {
          simulationConfig: true,
          quizConfig: true,
          subjectiveConfig: true,
          scoringCriteria: { orderBy: { order: "asc" } },
          quizQuestions: { orderBy: { order: "asc" } },
        },
      },
      simulationSubmission: true,
      quizSubmission: true,
      subjectiveSubmission: true,
      taskInstance: {
        select: { id: true, releaseMode: true, autoReleaseAt: true, dueAt: true, createdBy: true },
      },
    },
  });

  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");

  // PR-SIM-1a D1: 提前算好 releasedAt（每个 grade* 函数会传给 updateSubmissionGrade）
  const releasedAt = computeReleasedAtForGrading({
    releaseMode: submission.taskInstance?.releaseMode ?? null,
    autoReleaseAt: submission.taskInstance?.autoReleaseAt ?? null,
  });

  // 更新状态为批改中
  await updateSubmissionGrade(submissionId, { status: "grading" });

  try {
    switch (submission.taskType) {
      case "simulation":
        await gradeSimulation(submission, releasedAt);
        break;
      case "quiz":
        await gradeQuiz(submission, releasedAt);
        break;
      case "subjective":
        await gradeSubjective(submission, releasedAt);
        break;
    }

    await logAudit({
      action: "submission.grade",
      actorId: submission.studentId,
      targetId: submissionId,
      targetType: "Submission",
      metadata: { taskType: submission.taskType, status: "graded" },
    });
  } catch (error) {
    console.error("批改失败:", error);
    await updateSubmissionGrade(submissionId, { status: "failed" });

    await logAudit({
      action: "submission.grade.failed",
      actorId: submission.studentId,
      targetId: submissionId,
      targetType: "Submission",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    throw error;
  }
}

// ============================================
// 模拟对话批改
// ============================================

async function gradeSimulation(submission: SubmissionFull, releasedAt: Date | null) {
  if (!submission.simulationSubmission || !submission.task.simulationConfig) {
    throw new Error("MISSING_SIMULATION_DATA");
  }

  const config = submission.task.simulationConfig;
  const transcript = (submission.simulationSubmission.transcript as Array<{ role: string; text: string }>) || [];
  const assets = submission.simulationSubmission.assets as Record<string, unknown> | null;

  const settingsUserId = getSubmissionSettingsUserId(submission);
  const evaluation = await aiService.evaluateSimulation(submission.studentId, {
    taskName: submission.task.taskName,
    requirements: submission.task.requirements || undefined,
    scenario: config.scenario,
    evaluatorPersona: config.evaluatorPersona || undefined,
    strictnessLevel: config.strictnessLevel,
    transcript,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rubric: submission.task.scoringCriteria.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      maxPoints: c.maxPoints,
    })),
    assets: assets as Parameters<typeof aiService.evaluateSimulation>[1]["assets"],
  }, {
    settingsUserId,
    metadata: {
      submissionId: submission.id,
      taskId: submission.taskId,
      taskInstanceId: submission.taskInstanceId,
      settingsSource: settingsUserId === submission.studentId ? "student_fallback" : "teacher",
    },
  });
  const penalty = computeLatePenalty({
    score: evaluation.totalScore,
    maxScore: evaluation.maxScore,
    dueAt: submission.taskInstance?.dueAt,
    submittedAt: submission.submittedAt,
  });

  await updateSubmissionGrade(submission.id, {
    status: "graded",
    score: penalty.score,
    maxScore: evaluation.maxScore,
    evaluation: {
      ...(evaluation as unknown as Record<string, unknown>),
      totalScore: penalty.score,
      latePenalty: latePenaltyMetadata(penalty),
    },
    conceptTags: evaluation.conceptTags ?? [],
    releasedAt,
  });
}

// ============================================
// 测验批改
// ============================================

async function gradeQuiz(submission: SubmissionFull, releasedAt: Date | null) {
  if (!submission.quizSubmission) {
    throw new Error("MISSING_QUIZ_DATA");
  }

  const answers = (submission.quizSubmission.answers as Array<{
    questionId: string;
    selectedOptionIds?: string[];
    textAnswer?: string;
  }>) || [];

  const questions = submission.task.quizQuestions;
  const settingsUserId = getSubmissionSettingsUserId(submission);
  let totalScore = 0;
  let maxScore = 0;
  const breakdown: Array<{
    questionId: string;
    score: number;
    maxScore: number;
    correct: boolean;
    comment: string;
  }> = [];

  for (const question of questions) {
    maxScore += question.points;
    const answer = answers.find((a) => a.questionId === question.id);

    if (!answer) {
      breakdown.push({
        questionId: question.id,
        score: 0,
        maxScore: question.points,
        correct: false,
        comment: "未作答",
      });
      continue;
    }

    // 选择题和判断题：精确匹配
    if (question.type === "single_choice" || question.type === "multiple_choice" || question.type === "true_false") {
      const selected = (answer.selectedOptionIds || []).sort();
      const correct = (question.correctOptionIds || []).sort();
      const isCorrect = JSON.stringify(selected) === JSON.stringify(correct);

      const score = isCorrect ? question.points : 0;
      totalScore += score;

      breakdown.push({
        questionId: question.id,
        score,
        maxScore: question.points,
        correct: isCorrect,
        comment: isCorrect ? "回答正确" : `正确答案: ${correct.join(", ")}`,
      });
    }
    // 简答题：AI 批改
    else if (question.type === "short_answer") {
      try {
        const result = await gradeShortAnswer(
          submission.studentId,
          settingsUserId,
          question.prompt,
          answer.textAnswer || "",
          question.correctAnswer || "",
          question.points
        );
        totalScore += result.score;
        breakdown.push({
          questionId: question.id,
          ...result,
        });
      } catch {
        breakdown.push({
          questionId: question.id,
          score: 0,
          maxScore: question.points,
          correct: false,
          comment: "AI 批改失败，请等待教师手动批改",
        });
      }
    }
  }

  const penalty = computeLatePenalty({
    score: totalScore,
    maxScore,
    dueAt: submission.taskInstance?.dueAt,
    submittedAt: submission.submittedAt,
  });
  const evaluation = {
    totalScore: penalty.score,
    maxScore,
    feedback: appendLatePenaltyFeedback(
      `测验已完成，原始得分 ${totalScore}/${maxScore}`,
      penalty,
    ),
    quizBreakdown: breakdown,
    latePenalty: latePenaltyMetadata(penalty),
  };

  // PR-FIX-3 C4: quiz 也写 conceptTags（best-effort AI 提取，让 insights aggregate 能聚合 quiz 类）
  // 失败不阻塞批改主流程（catch + 空数组）。
  let conceptTags: string[] = [];
  try {
    conceptTags = await extractQuizConceptTags(submission.studentId, settingsUserId, questions);
  } catch (err) {
    console.error("[grading] quiz conceptTags 提取失败（不阻塞）：", err);
  }

  await updateSubmissionGrade(submission.id, {
    status: "graded",
    score: penalty.score,
    maxScore,
    evaluation: evaluation as unknown as Record<string, unknown>,
    conceptTags,
    releasedAt,
  });
}

// PR-FIX-3 C4: AI 从 quiz 题目 prompts 提取 3-5 个金融教学核心概念标签
// （quiz 是确定性批改，没有 AI 评估输出可解析；为聚合统一性单独喂 prompts → tags）
async function extractQuizConceptTags(
  userId: string,
  settingsUserId: string,
  questions: Array<{ prompt: string }>,
): Promise<string[]> {
  if (questions.length === 0) return [];
  const schema = z.object({
    conceptTags: z.array(z.string()).default([]),
  });
  const prompts = questions
    .slice(0, 30)
    .map((q, i) => `${i + 1}. ${q.prompt.slice(0, 200)}`)
    .join("\n");
  const out = await aiService.aiGenerateJSON(
    "quizGrade",
    userId,
    `你是一位金融教育课程顾问。基于一组测验题目的 prompt，归纳本次测验涉及的 3-5 个金融教学核心概念标签（如"CAPM""资产配置""风险偏好"等）。
输出严格 JSON: {"conceptTags": ["概念1","概念2",...]}`,
    `测验题目（共 ${questions.length} 题）:
${prompts}

请按上面 JSON 格式输出。`,
    schema,
    2,
    { settingsUserId, metadata: { settingsSource: settingsUserId === userId ? "student_fallback" : "teacher" } },
  );
  return Array.isArray(out.conceptTags) ? out.conceptTags.slice(0, 5) : [];
}

async function gradeShortAnswer(
  userId: string,
  settingsUserId: string,
  prompt: string,
  studentAnswer: string,
  referenceAnswer: string,
  maxPoints: number
): Promise<{ score: number; maxScore: number; correct: boolean; comment: string }> {
  const schema = z.object({
    score: z.number().min(0),
    comment: z.string(),
  });

  const result = await aiService.aiGenerateJSON(
    "quizGrade",
    userId,
    `你是一位严谨的金融课程阅卷老师。请根据参考答案评估学生的简答题作答。

评分精度指导：
- 完全匹配参考答案（含同义词、近义词表达）→ 满分
- 部分匹配（答对核心要点但不完整）→ 按匹配程度比例给分
- 完全不相关 → 0 分
- 容忍合理的同义词和近义词表达，不要求与参考答案逐字匹配`,
    `题目: ${prompt}
参考答案: ${referenceAnswer}
学生作答: ${studentAnswer}
满分: ${maxPoints}

    请返回 JSON: {"score": 得分(0到${maxPoints}之间的整数), "comment": "评语"}`,
    schema,
    2,
    { settingsUserId, metadata: { settingsSource: settingsUserId === userId ? "student_fallback" : "teacher" } },
  );

  const score = Math.min(Math.max(0, Math.round(result.score)), maxPoints);
  return {
    score,
    maxScore: maxPoints,
    correct: score >= maxPoints * 0.8,
    comment: result.comment,
  };
}

// ============================================
// 主观题批改
// ============================================

async function gradeSubjective(submission: SubmissionFull, releasedAt: Date | null) {
  if (!submission.subjectiveSubmission || !submission.task.subjectiveConfig) {
    throw new Error("MISSING_SUBJECTIVE_DATA");
  }

  const config = submission.task.subjectiveConfig;
  const textAnswer = submission.subjectiveSubmission.textAnswer || "";
  const extractedText = submission.subjectiveSubmission.extractedText || "";
  const combinedText = [textAnswer, extractedText].filter(Boolean).join("\n\n");

  if (!combinedText.trim()) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    await updateSubmissionGrade(submission.id, {
      status: "graded",
      score: 0,
      maxScore: submission.task.scoringCriteria.reduce((sum: number, c: any) => sum + c.maxPoints, 0),
      evaluation: {
        totalScore: 0,
        maxScore: submission.task.scoringCriteria.reduce((sum: number, c: any) => sum + c.maxPoints, 0),
        feedback: "未提交有效内容",
        rubricBreakdown: submission.task.scoringCriteria.map((c: any) => ({
          criterionId: c.id,
          score: 0,
          maxScore: c.maxPoints,
          comment: "未提交",
        })),
      },
      releasedAt,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return;
  }

  const evaluationSchema = z.object({
    totalScore: z.number(),
    feedback: z.string(),
    rubricBreakdown: z.array(z.object({
      criterionId: z.string(),
      score: z.number(),
      maxScore: z.number(),
      comment: z.string(),
    })),
    conceptTags: z.array(z.string()).optional(),
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rubric = submission.task.scoringCriteria;
  const settingsUserId = getSubmissionSettingsUserId(submission);
  const maxScore = rubric.reduce((sum: number, c: any) => sum + c.maxPoints, 0);

  const systemPrompt = `${config.evaluatorPersona || "你是一位资深的金融课程评估专家。"}

严格度: ${config.strictnessLevel}
严格度说明：
- STRICT / VERY_STRICT: 仅在作答中有明确证据支撑时才给分，推断不计分。
- MODERATE: 合理推断可适当给分，但需注明依据。
- LENIENT: 只要方向正确即可给分，鼓励学生参与。

题目: ${config.prompt}
${config.referenceAnswer ? `参考答案: ${config.referenceAnswer}` : ""}

评分标准:
${rubric.map((r: any) => `- ${r.name} (满分${r.maxPoints}分): ${r.description || ""}`).join("\n")}`;

  const result = await aiService.aiGenerateJSON(
    "subjectiveGrade",
    submission.studentId,
    systemPrompt,
    `学生作答:\n${combinedText}\n\n请按评分标准逐项评估，返回 JSON:
{"totalScore": 总分, "feedback": "总体评语", "rubricBreakdown": [{"criterionId": "ID", "score": 得分, "maxScore": 满分, "comment": "评语"}], "conceptTags": ["概念1","概念2","概念3"]}
criterionId 使用: ${rubric.map((r: any) => r.id).join(", ")}
conceptTags 输出本次答卷涉及的 3-5 个金融教学核心概念标签（如"CAPM""资产配置""风险偏好"等），用于班级薄弱点聚合。`,
    evaluationSchema,
    2,
    {
      settingsUserId,
      metadata: {
        submissionId: submission.id,
        taskId: submission.taskId,
        taskInstanceId: submission.taskInstanceId,
        settingsSource: settingsUserId === submission.studentId ? "student_fallback" : "teacher",
      },
    },
  );

  // 标准化
  const breakdown = rubric.map((r: any) => {
    const found = result.rubricBreakdown.find((b) => b.criterionId === r.id);
    return {
      criterionId: r.id,
      score: found ? Math.min(found.score, r.maxPoints) : 0,
      maxScore: r.maxPoints,
      comment: found?.comment || "暂无评语",
    };
  });
  const totalScore = breakdown.reduce((sum: number, b: any) => sum + b.score, 0);
  const conceptTags = Array.isArray(result.conceptTags)
    ? result.conceptTags.slice(0, 5)
    : [];
  const penalty = computeLatePenalty({
    score: totalScore,
    maxScore,
    dueAt: submission.taskInstance?.dueAt,
    submittedAt: submission.submittedAt,
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  await updateSubmissionGrade(submission.id, {
    status: "graded",
    score: penalty.score,
    maxScore,
    evaluation: {
      totalScore: penalty.score,
      maxScore,
      feedback: appendLatePenaltyFeedback(result.feedback, penalty),
      rubricBreakdown: breakdown,
      latePenalty: latePenaltyMetadata(penalty),
    },
    conceptTags,
    releasedAt,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubmissionFull = any;

function getSubmissionSettingsUserId(submission: SubmissionFull): string {
  return (
    submission.taskInstance?.createdBy ||
    submission.task?.creatorId ||
    submission.studentId
  );
}
