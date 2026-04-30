import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  assertKnowledgeSourceScope,
  getKnowledgeSourcesForDraft,
} from "@/lib/services/course-knowledge-source.service";

const requestSchema = z.object({
  taskType: z.enum(["quiz", "subjective", "simulation"]),
  courseId: z.string().uuid(),
  chapterId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  taskName: z.string().optional(),
  description: z.string().optional(),
  teacherBrief: z.string().optional(),
  sourceIds: z.array(z.string().uuid()).default([]),
});

const questionSchema = z.object({
  type: z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  correctOptionIds: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  points: z.number().min(1).max(10).default(1),
  difficulty: z.number().min(1).max(5).optional(),
  explanation: z.string().optional(),
});

const criterionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  maxPoints: z.number().min(1).max(100),
});

const taskDraftSchema = z.object({
  taskName: z.string(),
  description: z.string(),
  totalPoints: z.number().min(1).max(300).optional(),
  timeLimitMinutes: z.number().int().min(1).max(240).nullable().optional(),
  draftNotes: z.string().optional(),
  quiz: z
    .object({
      questions: z.array(questionSchema).min(1),
      quizMode: z.enum(["fixed", "adaptive"]).default("fixed").optional(),
      showResult: z.boolean().default(true).optional(),
    })
    .optional(),
  subjective: z
    .object({
      prompt: z.string(),
      requirements: z.array(z.string()).default([]),
      referenceAnswer: z.string().optional(),
      scoringCriteria: z.array(criterionSchema).min(1),
    })
    .optional(),
  simulation: z
    .object({
      scenario: z.string(),
      openingLine: z.string(),
      requirements: z.array(z.string()).default([]),
      scoringCriteria: z.array(criterionSchema).min(1),
      allocationSections: z
        .array(
          z.object({
            label: z.string(),
            items: z.array(z.object({ label: z.string(), defaultValue: z.number().optional() })).min(1),
          }),
        )
        .default([]),
      simPersona: z.string(),
      simDialogueStyle: z.string(),
      simConstraints: z.string(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return validationError("请求参数错误", parsed.error.flatten());

    const user = result.session.user;
    const data = parsed.data;
    await assertCourseAccess(data.courseId, user.id, user.role);
    await assertKnowledgeSourceScope({
      courseId: data.courseId,
      chapterId: data.chapterId,
      sectionId: data.sectionId,
    });

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
      getKnowledgeSourcesForDraft({
        courseId: data.courseId,
        sourceIds: data.sourceIds,
      }),
    ]);

    if (!course) throw new Error("COURSE_NOT_FOUND");

    const draft = await aiGenerateJSON(
      "taskDraft",
      user.id,
      buildSystemPrompt(data.taskType),
      buildUserPrompt({
        taskType: data.taskType,
        courseName: course.courseTitle,
        courseDescription: course.description,
        chapterName: chapter?.title || "",
        sectionName: section?.title || "",
        taskName: data.taskName,
        description: data.description,
        teacherBrief: data.teacherBrief,
        sources,
      }),
      taskDraftSchema,
      1,
    );

    if (!hasRequestedDraftSection(draft, data.taskType)) {
      return validationError("AI 返回的草稿类型不完整，请补充需求后重试");
    }

    return success({
      ...draft,
      sourceSummary: sources.map((source) => ({
        id: source.id,
        fileName: source.fileName,
        conceptTags: source.conceptTags,
      })),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

function hasRequestedDraftSection(
  draft: z.infer<typeof taskDraftSchema>,
  taskType: "quiz" | "subjective" | "simulation",
) {
  if (taskType === "quiz") return Boolean(draft.quiz);
  if (taskType === "subjective") return Boolean(draft.subjective);
  return Boolean(draft.simulation);
}

function buildSystemPrompt(taskType: "quiz" | "subjective" | "simulation") {
  const typeLabel =
    taskType === "quiz" ? "测验" : taskType === "subjective" ? "主观题" : "模拟对话";

  return `你是一位面向中高职学校的课程教研与出题助手。请根据课程素材和教师需求生成可由教师审核的${typeLabel}草稿。

边界：
- 不要做跨课程能力诊断，只围绕当前课程/章节/小节。
- 题目和情境要适合中高职课堂，避免 MBA、投行、研究生案例等不相干语境。
- 概念标签只代表素材涉及概念，不要把它们当作学生弱点。
- 返回严格 JSON。`;
}

function buildUserPrompt(input: {
  taskType: "quiz" | "subjective" | "simulation";
  courseName: string;
  courseDescription: string | null;
  chapterName: string;
  sectionName: string;
  taskName?: string;
  description?: string;
  teacherBrief?: string;
  sources: Array<{
    fileName: string;
    summary: string | null;
    conceptTags: string[];
    text: string;
  }>;
}) {
  const sourceText = input.sources
    .map(
      (source, index) => `【素材 ${index + 1}: ${source.fileName}】
摘要：${source.summary || "无"}
概念：${source.conceptTags.join(" / ") || "无"}
正文摘录：
${source.text.slice(0, 6000)}`,
    )
    .join("\n\n");

  return `任务类型：${input.taskType}
课程：${input.courseName}
课程描述：${input.courseDescription || "无"}
章节：${input.chapterName || "未指定"}
小节：${input.sectionName || "未指定"}
已有任务名称：${input.taskName || "未填写"}
已有任务描述：${input.description || "未填写"}
教师高维需求：${input.teacherBrief || "未填写"}

课程素材：
${sourceText || "未选择素材，请基于课程/章节/教师需求生成。"}

请返回 JSON：
{
  "taskName": "任务名称",
  "description": "任务说明",
  "totalPoints": 100,
  "timeLimitMinutes": 30,
  "draftNotes": "说明 AI 根据哪些素材和需求填充了哪些字段",
  "quiz": {
    "quizMode": "fixed",
    "showResult": true,
    "questions": [
      {
        "type": "single_choice|multiple_choice|true_false|short_answer",
        "prompt": "题干",
        "options": [{"id": "A", "text": "选项"}],
        "correctOptionIds": ["A"],
        "correctAnswer": "简答参考答案",
        "points": 1,
        "difficulty": 1,
        "explanation": "解析"
      }
    ]
  },
  "subjective": {
    "prompt": "题干",
    "requirements": ["要求1", "要求2"],
    "referenceAnswer": "参考答案",
    "scoringCriteria": [{"name": "评分维度", "description": "评分说明", "maxPoints": 25}]
  },
  "simulation": {
    "scenario": "对话场景",
    "openingLine": "AI 客户开场白",
    "requirements": ["学生需完成的目标"],
    "scoringCriteria": [{"name": "评分维度", "description": "评分说明", "maxPoints": 25}],
    "allocationSections": [{"label": "资产类别", "items": [{"label": "项目", "defaultValue": 0}]}],
    "simPersona": "AI 客户人设",
    "simDialogueStyle": "对话风格",
    "simConstraints": "禁止行为与边界"
  }
}

只填充当前任务类型对应的对象，但保留同一个 JSON 外层结构。`;
}
