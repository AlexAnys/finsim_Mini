import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  buildQuestionBankPrompt,
  QUESTION_BANK_PROMPT_VERSION,
} from "@/lib/ai/prompts/question-bank";
import {
  assertKnowledgeSourceScope,
  getKnowledgeSourcesForDraft,
} from "@/lib/services/course-knowledge-source.service";
import { updateTaskBuildDraft } from "@/lib/services/task-build-draft.service";
import {
  parseStructuredQuestionBank,
  toImportedQuestion,
  type RegexImportedQuestion,
} from "@/lib/services/question-bank-regex.service";

const questionTypeSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    单选: "single_choice",
    单选题: "single_choice",
    single: "single_choice",
    single_choice: "single_choice",
    multiple: "multiple_choice",
    multiple_choice: "multiple_choice",
    多选: "multiple_choice",
    多选题: "multiple_choice",
    判断: "true_false",
    判断题: "true_false",
    true_false: "true_false",
    truefalse: "true_false",
    简答: "short_answer",
    简答题: "short_answer",
    short_answer: "short_answer",
    shortanswer: "short_answer",
  };
  return map[normalized] || value;
}, z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]));

const currentQuestionSchema = z.object({
  type: questionTypeSchema,
  stem: z.string().default(""),
  options: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
  correctOptionIds: z.array(z.string()).default([]),
  correctAnswer: z.string().default(""),
  points: z.number().min(1).max(100).default(1),
  explanation: z.string().default(""),
});

const requestSchema = z.object({
  action: z.enum(["import", "check", "optimize", "checkOptimize"]),
  courseId: z.string().uuid(),
  chapterId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  draftId: z.string().uuid().optional().nullable(),
  sourceIds: z.array(z.string().uuid()).default([]),
  teacherBrief: z.string().optional(),
  questions: z.array(currentQuestionSchema).default([]),
});

const issueSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  message: z.string().min(1),
  questionIndex: z.number().int().min(0).optional(),
  sourceRef: z.string().optional(),
});

const importedQuestionSchema = z.object({
  type: questionTypeSchema.default("single_choice"),
  prompt: z.string().default(""),
  options: z
    .array(
      z.object({
        id: z.string().default(""),
        text: z.string().default(""),
      }),
    )
    .default([]),
  correctOptionIds: z.array(z.string()).default([]),
  correctAnswer: z.string().default(""),
  explanation: z.string().default(""),
  points: z.number().min(1).max(100).default(1),
  conceptTags: z.array(z.string()).default([]),
  sourceRefs: z
    .array(
      z.object({
        sourceId: z.string().optional(),
        fileName: z.string().optional(),
        page: z.string().optional(),
        row: z.string().optional(),
        excerpt: z.string().optional(),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  needsReview: z.boolean().default(false),
  aiSupplemented: z.boolean().default(false),
  issues: z.array(z.string()).default([]),
});

export const questionBankResponseSchema = z.object({
  summary: z.string().default(""),
  issues: z.array(issueSchema).default([]),
  questions: z.array(importedQuestionSchema).default([]),
});

export type QuestionBankRequest = z.infer<typeof requestSchema>;
export type QuestionBankResponse = z.infer<typeof questionBankResponseSchema>;

export function parseQuestionBankRequest(input: unknown) {
  return requestSchema.safeParse(input);
}

export async function runQuestionBankProcessing(
  rawInput: unknown,
  userId: string,
  onProgress?: (progress: number) => Promise<void> | void,
) {
  const parsed = requestSchema.parse(rawInput);
  const data = normalizeRequestAction(parsed);
  await onProgress?.(12);
  await assertKnowledgeSourceScope({
    courseId: data.courseId,
    chapterId: data.chapterId,
    sectionId: data.sectionId,
  });

  if (data.action === "import" && data.sourceIds.length === 0) {
    throw new Error("请先选择要导入的课程素材");
  }
  if (data.action === "checkOptimize" && data.sourceIds.length === 0 && data.questions.length === 0) {
    throw new Error("请先选择素材或添加题目后再质检优化");
  }

  const [course, chapter, section, sources] = await Promise.all([
    prisma.course.findUnique({
      where: { id: data.courseId },
      select: { courseTitle: true, description: true },
    }),
    data.chapterId
      ? prisma.chapter.findUnique({ where: { id: data.chapterId }, select: { title: true } })
      : Promise.resolve(null),
    data.sectionId
      ? prisma.section.findUnique({ where: { id: data.sectionId }, select: { title: true } })
      : Promise.resolve(null),
    getKnowledgeSourcesForDraft({ courseId: data.courseId, sourceIds: data.sourceIds }),
  ]);

  if (!course) throw new Error("COURSE_NOT_FOUND");
  await onProgress?.(28);

  // ====== Regex 直抽（仅 import 模式且素材有可读文本时） ======
  let regexQuestions: RegexImportedQuestion[] = [];
  let regexSummary = "";
  let regexNeedsAi = true;
  if (data.action === "import" && sources.length > 0) {
    const collected: RegexImportedQuestion[] = [];
    let totalParsed = 0;
    let totalUnparsedLen = 0;
    for (const source of sources) {
      if (!source.text || source.text.length < 20) continue;
      const r = parseStructuredQuestionBank(source.text);
      totalParsed += r.questions.length;
      totalUnparsedLen += r.unparsedTail.length;
      for (const q of r.questions) {
        if (q.confidence >= 0.7) {
          collected.push(toImportedQuestion(q, { sourceId: source.id, fileName: source.fileName }));
        }
      }
    }
    regexQuestions = collected;
    if (collected.length > 0) {
      regexSummary = `通过结构化解析直接识别 ${collected.length} 题（共扫到 ${totalParsed} 个题块）。`;
      // 高置信度题已覆盖大部分内容，且尾部未识别文本短，可直接跳过 AI
      if (totalUnparsedLen < 200 && collected.length >= Math.max(3, totalParsed * 0.6)) {
        regexNeedsAi = false;
      }
    }
  }
  await onProgress?.(40);

  // ====== AI 路径（fallback / checkOptimize 必跑） ======
  let aiQuestions: QuestionBankResponse["questions"] = [];
  let aiSummary = "";
  let aiIssues: QuestionBankResponse["issues"] = [];
  let aiError: Error | null = null;

  const shouldCallAi = data.action === "checkOptimize" || regexNeedsAi;
  if (shouldCallAi) {
    try {
      const builtQB = buildQuestionBankPrompt({
        action: data.action,
        courseName: course.courseTitle,
        courseDescription: course.description || "",
        chapterName: chapter?.title || "",
        sectionName: section?.title || "",
        teacherBrief: data.teacherBrief || "",
        sources,
        questions: data.questions,
      });
      const aiResult = await aiGenerateJSON(
        data.action === "checkOptimize" ? "questionAnalysis" : "importParse",
        userId,
        builtQB.systemPrompt,
        builtQB.userPrompt,
        questionBankResponseSchema,
        1,
        {
          metadata: {
            tool: "questionBank",
            action: data.action,
            courseId: data.courseId,
            draftId: data.draftId || null,
            sourceCount: data.sourceIds.length,
            questionCount: data.questions.length,
            regexPreCount: regexQuestions.length,
          },
          promptVersion: QUESTION_BANK_PROMPT_VERSION,
        },
      );
      const normalized = normalizeQuestionBankResult(aiResult, data.action);
      aiQuestions = normalized.questions;
      aiSummary = normalized.summary;
      aiIssues = normalized.issues;
    } catch (err) {
      aiError = err instanceof Error ? err : new Error(String(err));
      console.error("[question-bank] AI 调用失败：", aiError);
    }
  }

  await onProgress?.(78);

  // ====== 合并 + 兜底 ======
  let mergedQuestions: RegexImportedQuestion[];
  if (data.action === "import") {
    mergedQuestions = [...regexQuestions];
    // AI 仅在 regex 没覆盖到的部分作补充（避免重复）
    if (aiQuestions.length > 0 && regexQuestions.length === 0) {
      mergedQuestions = aiQuestions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctOptionIds: q.correctOptionIds,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: q.points,
        conceptTags: q.conceptTags,
        sourceRefs: q.sourceRefs.map((ref) => ({
          sourceId: ref.sourceId,
          fileName: ref.fileName,
          page: ref.page,
          row: ref.row,
          excerpt: ref.excerpt,
        })),
        confidence: q.confidence,
        needsReview: q.needsReview,
        aiSupplemented: q.aiSupplemented,
        issues: q.issues,
      }));
    } else if (aiQuestions.length > 0) {
      // 两路都有 → AI 补刀题加 aiSupplemented 标记
      const regexPrompts = new Set(regexQuestions.map((q) => q.prompt.trim()));
      for (const aq of aiQuestions) {
        if (!regexPrompts.has(aq.prompt.trim())) {
          mergedQuestions.push({
            type: aq.type,
            prompt: aq.prompt,
            options: aq.options,
            correctOptionIds: aq.correctOptionIds,
            correctAnswer: aq.correctAnswer,
            explanation: aq.explanation,
            points: aq.points,
            conceptTags: aq.conceptTags,
            sourceRefs: aq.sourceRefs.map((ref) => ({ ...ref })),
            confidence: aq.confidence,
            needsReview: aq.needsReview,
            aiSupplemented: true,
            issues: aq.issues,
          });
        }
      }
    }

    if (mergedQuestions.length === 0) {
      // 真没识别到 → 给出有意义的错误，区分 AI 故障 vs 素材为空
      if (aiError) {
        throw new Error(
          `未能识别到题目：结构化解析无结果，AI 也无法解析（${friendlyAiError(aiError)}）。建议检查素材或改用手动添加。`,
        );
      }
      throw new Error("未从所选素材中识别到可导入题目，请检查素材内容或改用手动添加");
    }
  } else {
    // checkOptimize：完全交给 AI 的产出
    mergedQuestions = aiQuestions.map((q) => ({
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correctOptionIds: q.correctOptionIds,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      points: q.points,
      conceptTags: q.conceptTags,
      sourceRefs: q.sourceRefs.map((ref) => ({ ...ref })),
      confidence: q.confidence,
      needsReview: q.needsReview,
      aiSupplemented: q.aiSupplemented,
      issues: q.issues,
    }));
  }

  const summaryParts: string[] = [];
  if (regexSummary) summaryParts.push(regexSummary);
  if (aiSummary) summaryParts.push(aiSummary);
  if (aiError && data.action === "import" && regexQuestions.length > 0) {
    summaryParts.push(
      `AI 未能调用（${friendlyAiError(aiError)}），但已通过结构化解析直接导入 ${regexQuestions.length} 题。`,
    );
  }
  const summary = summaryParts.join(" ") || "已完成题库处理。";

  const result = {
    summary,
    issues: aiIssues,
    questions: mergedQuestions,
    action: data.action,
    sourceSummary: sources.map((source) => ({
      id: source.id,
      fileName: source.fileName,
      conceptTags: source.conceptTags,
    })),
  };

  if (data.draftId) {
    await writeQuestionBankResultToDraft(data.draftId, data, result);
  }
  await onProgress?.(95);
  return result as unknown as Prisma.InputJsonValue;
}

function friendlyAiError(err: Error): string {
  const msg = err.message || "";
  if (/AI_PROVIDER_NOT_CONFIGURED/i.test(msg)) return "AI 未配置 API key";
  if (/RATE_LIMIT_EXCEEDED/i.test(msg)) return "AI 调用已限流，请稍后再试";
  if (/timeout|timed out/i.test(msg)) return "AI 响应超时";
  if (/unexpected (?:end|token)|json|zod|syntaxerror/i.test(msg)) return "AI 返回格式不完整";
  return "AI 服务异常";
}

function normalizeRequestAction(input: QuestionBankRequest) {
  return {
    ...input,
    action:
      input.action === "check" || input.action === "optimize"
        ? ("checkOptimize" as const)
        : input.action,
  };
}

async function writeQuestionBankResultToDraft(
  draftId: string,
  input: ReturnType<typeof normalizeRequestAction>,
  result: QuestionBankResponse & {
    action: "import" | "checkOptimize";
    sourceSummary: Array<{ id: string; fileName: string; conceptTags: string[] }>;
  },
) {
  const draft = await prisma.taskBuildDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) throw new Error("TASK_BUILD_DRAFT_NOT_FOUND");
  if (draft.courseId !== input.courseId) throw new Error("TASK_BUILD_DRAFT_SCOPE_MISMATCH");

  const payload: Record<string, Prisma.InputJsonValue> = isRecord(draft.draftPayload)
    ? { ...(draft.draftPayload as Record<string, Prisma.InputJsonValue>) }
    : {};
  const form: Record<string, Prisma.InputJsonValue> = isRecord(payload.form)
    ? { ...(payload.form as Record<string, Prisma.InputJsonValue>) }
    : {};

  if (input.action === "import") {
    const currentQuestions = Array.isArray(form.questions) ? form.questions : [];
    form.questions = mergeImportedQuestions(currentQuestions, result.questions) as Prisma.InputJsonValue;
  }

  payload.form = form;
  payload.selectedSourceIds = input.sourceIds;
  payload.teacherBrief = input.teacherBrief || payload.teacherBrief || "";
  payload.draftSourceLabel = buildDraftSourceLabel(result);
  payload.questionBankReview = {
    action: input.action,
    summary: result.summary,
    issues: result.issues,
    suggestions: input.action === "checkOptimize" ? result.questions : [],
    sourceSummary: result.sourceSummary,
    updatedAt: new Date().toISOString(),
  };

  const missingFields = draft.missingFields.filter((field) => {
    if (field === "题目" && Array.isArray(form.questions) && form.questions.length > 0) return false;
    return true;
  });

  // 快照 AI 原稿到 aiPayload（用于审核页 left-right diff），draftPayload 是教师编辑稿载体
  await updateTaskBuildDraft(draftId, {
    status: "ready",
    progress: 100,
    sourceIds: input.sourceIds.length > 0 ? input.sourceIds : draft.sourceIds,
    missingFields,
    draftPayload: payload as Prisma.InputJsonValue,
    aiPayload: payload as Prisma.InputJsonValue,
    error: null,
  });
}

function mergeImportedQuestions(currentQuestions: unknown[], imported: QuestionBankResponse["questions"]) {
  const normalized = imported.map((question) => ({
    type: question.type,
    stem: addImportMarkers(question),
    options: normalizeOptions(question.type, question.options),
    correctOptionIds: question.correctOptionIds,
    correctAnswer: question.correctAnswer,
    points: question.points,
    explanation: [
      question.explanation,
      question.issues.length > 0 ? `导入提示：${question.issues.join("；")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  }));

  if (currentQuestions.length === 1 && isBlankQuestion(currentQuestions[0])) {
    return normalized;
  }
  return [...currentQuestions, ...normalized];
}

function isBlankQuestion(question: unknown) {
  if (!isRecord(question)) return false;
  const stem = typeof question.stem === "string" ? question.stem : "";
  const correctAnswer = typeof question.correctAnswer === "string" ? question.correctAnswer : "";
  const correctOptionIds = Array.isArray(question.correctOptionIds) ? question.correctOptionIds : [];
  const options = Array.isArray(question.options) ? question.options : [];
  return (
    !stem.trim() &&
    !correctAnswer.trim() &&
    correctOptionIds.length === 0 &&
    options.every((option) => !isRecord(option) || typeof option.text !== "string" || !option.text.trim())
  );
}

function addImportMarkers(question: QuestionBankResponse["questions"][number]) {
  const reviewPrefix = question.needsReview ? "【待确认】" : "";
  const aiPrefix = question.aiSupplemented ? "【AI 补充】" : "";
  return `${aiPrefix}${reviewPrefix}${question.prompt}`.trim();
}

function buildDraftSourceLabel(
  result: QuestionBankResponse & {
    action: "import" | "checkOptimize";
    sourceSummary: Array<{ id: string; fileName: string; conceptTags: string[] }>;
  },
) {
  const sourceNames = result.sourceSummary.map((source) => source.fileName).join("、");
  const actionLabel = result.action === "import" ? "题库导入" : "素材质检与优化";
  return `${actionLabel}：${sourceNames || "教师要求 / 当前题目"}。${
    result.summary || "请在发布前逐题复核。"
  }`;
}

export function normalizeQuestionBankResult(
  result: QuestionBankResponse,
  action: "import" | "checkOptimize",
): QuestionBankResponse {
  const questions = result.questions
    .map((question) => {
      const options = normalizeOptions(question.type, question.options);
      const hasAnswer =
        question.type === "short_answer"
          ? Boolean(question.correctAnswer.trim())
          : question.correctOptionIds.length > 0;
      const issues = [...question.issues];
      if (!hasAnswer) issues.push("答案待确认");
      if (!question.explanation.trim()) issues.push("解析待确认");
      return {
        ...question,
        prompt: question.prompt.trim(),
        options,
        conceptTags: uniqueStrings(question.conceptTags),
        issues: uniqueStrings(issues),
        needsReview: question.needsReview || !hasAnswer || !question.explanation.trim(),
        aiSupplemented: action === "checkOptimize" || question.aiSupplemented,
      };
    })
    .filter((question) => question.prompt);

  return {
    summary: result.summary,
    issues: result.issues,
    questions,
  };
}

function normalizeOptions(
  type: "single_choice" | "multiple_choice" | "true_false" | "short_answer",
  options: Array<{ id: string; text: string }>,
) {
  if (type === "true_false") {
    return [
      { id: "A", text: "正确" },
      { id: "B", text: "错误" },
    ];
  }
  if (type === "short_answer") return [];
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return options
    .map((option, index) => ({
      id: option.id.trim() || labels[index] || String(index + 1),
      text: option.text.trim(),
    }))
    .filter((option) => option.text)
    .slice(0, 8);
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
