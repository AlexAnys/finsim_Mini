import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import * as aiService from "./ai.service";
import { updateSubmissionGrade } from "./submission.service";
import { logAudit } from "./audit.service";

// ============================================
// 统一批改入口
// ============================================

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
    },
  });

  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");

  // 更新状态为批改中
  await updateSubmissionGrade(submissionId, { status: "grading" });

  try {
    switch (submission.taskType) {
      case "simulation":
        await gradeSimulation(submission);
        break;
      case "quiz":
        await gradeQuiz(submission);
        break;
      case "subjective":
        await gradeSubjective(submission);
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
  }
}

// ============================================
// 模拟对话批改
// ============================================

async function gradeSimulation(submission: SubmissionFull) {
  if (!submission.simulationSubmission || !submission.task.simulationConfig) {
    throw new Error("MISSING_SIMULATION_DATA");
  }

  const config = submission.task.simulationConfig;
  const transcript = (submission.simulationSubmission.transcript as Array<{ role: string; text: string }>) || [];
  const assets = submission.simulationSubmission.assets as Record<string, unknown> | null;

  const evaluation = await aiService.evaluateSimulation(submission.studentId, {
    taskName: submission.task.taskName,
    requirements: submission.task.requirements || undefined,
    scenario: config.scenario,
    evaluatorPersona: config.evaluatorPersona || undefined,
    strictnessLevel: config.strictnessLevel,
    transcript,
    rubric: submission.task.scoringCriteria.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      maxPoints: c.maxPoints,
    })),
    assets: assets as Parameters<typeof aiService.evaluateSimulation>[1]["assets"],
  });

  await updateSubmissionGrade(submission.id, {
    status: "graded",
    score: evaluation.totalScore,
    maxScore: evaluation.maxScore,
    evaluation: evaluation as unknown as Record<string, unknown>,
  });
}

// ============================================
// 测验批改
// ============================================

async function gradeQuiz(submission: SubmissionFull) {
  if (!submission.quizSubmission) {
    throw new Error("MISSING_QUIZ_DATA");
  }

  const answers = (submission.quizSubmission.answers as Array<{
    questionId: string;
    selectedOptionIds?: string[];
    textAnswer?: string;
  }>) || [];

  const questions = submission.task.quizQuestions;
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

  const evaluation = {
    totalScore,
    maxScore,
    feedback: `测验已完成，得分 ${totalScore}/${maxScore}`,
    quizBreakdown: breakdown,
  };

  await updateSubmissionGrade(submission.id, {
    status: "graded",
    score: totalScore,
    maxScore,
    evaluation: evaluation as unknown as Record<string, unknown>,
  });
}

async function gradeShortAnswer(
  userId: string,
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
    "你是一位严谨的金融课程阅卷老师。请根据参考答案评估学生的简答题作答。",
    `题目: ${prompt}
参考答案: ${referenceAnswer}
学生作答: ${studentAnswer}
满分: ${maxPoints}

请返回 JSON: {"score": 得分(0到${maxPoints}之间的整数), "comment": "评语"}`,
    schema
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

async function gradeSubjective(submission: SubmissionFull) {
  if (!submission.subjectiveSubmission || !submission.task.subjectiveConfig) {
    throw new Error("MISSING_SUBJECTIVE_DATA");
  }

  const config = submission.task.subjectiveConfig;
  const textAnswer = submission.subjectiveSubmission.textAnswer || "";
  const extractedText = submission.subjectiveSubmission.extractedText || "";
  const combinedText = [textAnswer, extractedText].filter(Boolean).join("\n\n");

  if (!combinedText.trim()) {
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
    });
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
  });

  const rubric = submission.task.scoringCriteria;
  const maxScore = rubric.reduce((sum: number, c: any) => sum + c.maxPoints, 0);

  const systemPrompt = `${config.evaluatorPersona || "你是一位资深的金融课程评估专家。"}

严格度: ${config.strictnessLevel}

题目: ${config.prompt}
${config.referenceAnswer ? `参考答案: ${config.referenceAnswer}` : ""}

评分标准:
${rubric.map((r: any) => `- ${r.name} (满分${r.maxPoints}分): ${r.description || ""}`).join("\n")}`;

  const result = await aiService.aiGenerateJSON(
    "subjectiveGrade",
    submission.studentId,
    systemPrompt,
    `学生作答:\n${combinedText}\n\n请按评分标准逐项评估，返回 JSON:
{"totalScore": 总分, "feedback": "总体评语", "rubricBreakdown": [{"criterionId": "ID", "score": 得分, "maxScore": 满分, "comment": "评语"}]}
criterionId 使用: ${rubric.map((r: any) => r.id).join(", ")}`,
    evaluationSchema
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

  await updateSubmissionGrade(submission.id, {
    status: "graded",
    score: totalScore,
    maxScore,
    evaluation: {
      totalScore,
      maxScore,
      feedback: result.feedback,
      rubricBreakdown: breakdown,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubmissionFull = any;
