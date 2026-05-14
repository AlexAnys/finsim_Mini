import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
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
      const aiResult = await aiGenerateJSON(
        data.action === "checkOptimize" ? "questionAnalysis" : "importParse",
        userId,
        buildSystemPrompt(data.action),
        buildUserPrompt({
          action: data.action,
          courseName: course.courseTitle,
          courseDescription: course.description || "",
          chapterName: chapter?.title || "",
          sectionName: section?.title || "",
          teacherBrief: data.teacherBrief || "",
          sources,
          questions: data.questions,
        }),
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

function buildSystemPrompt(action: "import" | "checkOptimize") {
  if (action === "import") {
    return `你是题库导入助手。任务是从教师上传的题库素材中忠实提取原始题目。

规则：
- 只提取素材中已有的题目、选项、答案、解析、知识点和来源位置。
- 不要私自补写缺失答案或解析；不明确时设置 needsReview=true，并在 issues 中说明。
- 题型只能是 single_choice、multiple_choice、true_false、short_answer。
- 保留原题表达，不做润色改写。
- 返回严格 JSON。`;
  }

  return `你是题库质检与优化助手。必须同时给出"质检"和"补充题"两类输出，不能只给抽象建议。

【质检要求】
逐题检查导入题目，把以下问题写入 issues 数组（每条带 questionIndex 和 sourceRef）：
- 缺答案 / 缺解析 / 答案疑似错误（结合素材上下文判断）
- 选项语义歧义、选项之间互斥不清、唯一正确选项不明显
- 重复题或近似题
- 题型分布异常（如全是单选、缺少判断或多选）
- 题干表述不清、含错别字、语病

【补题要求】
基于课程/章节/小节/素材实际内容，新增至少 3-5 道高质量补充题，每道题：
- 必须有完整 prompt + 选项 + correctOptionIds 或 correctAnswer + explanation（不能留空）
- 标记 aiSupplemented=true
- 题型应均衡：至少各包含 1 道 single_choice / multiple_choice / true_false 或 short_answer
- conceptTags 必须填实际知识点（≥1 个），不要写 "无" / "暂无"
- explanation 不少于 30 字，给出推导过程或参考依据
- sourceRefs 引用具体 sourceId 和原文摘录

【硬性规则】
- 不覆盖原导入题。
- 已有题目不在 questions 数组里返回；只返回新增补充题。
- 题目须贴合当前课程、章节、小节、素材；不要泛泛之谈。
- 即使素材较短，也要尽量挖出 3 道补题。
- 返回严格 JSON。`;
}

function buildUserPrompt(input: {
  action: "import" | "checkOptimize";
  courseName: string;
  courseDescription: string;
  chapterName: string;
  sectionName: string;
  teacherBrief: string;
  sources: Array<{
    id: string;
    fileName: string;
    summary: string | null;
    conceptTags: string[];
    text: string;
  }>;
  questions: Array<z.infer<typeof currentQuestionSchema>>;
}) {
  const sourceText = input.sources
    .map((source, index) => `【素材 ${index + 1}: ${source.fileName}】
sourceId: ${source.id}
摘要：${source.summary || "无"}
概念：${source.conceptTags.join(" / ") || "无"}
正文摘录：
${source.text.slice(0, 7000)}`)
    .join("\n\n");

  const questionText = input.questions
    .map((question, index) => {
      const options = question.options.map((option) => `${option.id}. ${option.text}`).join("\n");
      const answer =
        question.type === "short_answer"
          ? question.correctAnswer
          : question.correctOptionIds.join(", ");
      return `【已有题目 ${index + 1}】
题型：${question.type}
题干：${question.stem}
选项：
${options || "无"}
答案：${answer || "未填写"}
解析：${question.explanation || "未填写"}`;
    })
    .join("\n\n");

  return `动作：${input.action}
课程：${input.courseName}
课程描述：${input.courseDescription || "无"}
章节：${input.chapterName || "未指定"}
小节：${input.sectionName || "未指定"}
教师要求：${input.teacherBrief || "未填写"}

课程素材：
${sourceText || "未选择素材。"}

当前题目：
${questionText || "暂无。"}

请返回 JSON：
{
  "summary": "本次导入/检查/优化的简短说明",
  "issues": [
    {"severity": "info|warning|critical", "message": "问题描述", "questionIndex": 0, "sourceRef": "页码或行号"}
  ],
  "questions": [
    {
      "type": "single_choice|multiple_choice|true_false|short_answer",
      "prompt": "题干",
      "options": [{"id": "A", "text": "选项文本"}],
      "correctOptionIds": ["A"],
      "correctAnswer": "简答参考答案",
      "explanation": "解析。缺失时留空",
      "points": 1,
      "conceptTags": ["知识点"],
      "sourceRefs": [{"sourceId": "素材ID", "fileName": "文件名", "page": "页码", "row": "行号", "excerpt": "原文片段"}],
      "confidence": 0.8,
      "needsReview": false,
      "aiSupplemented": ${input.action === "checkOptimize" ? "true" : "false"},
      "issues": ["答案待确认"]
    }
  ]
}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
