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
import {
  buildTaskDraftFromContextPrompt,
  TASK_DRAFT_FROM_CONTEXT_PROMPT_VERSION,
} from "@/lib/ai/prompts/task-draft-from-context";

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
  type: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    const map: Record<string, string> = {
      单选: "single_choice",
      单选题: "single_choice",
      single: "single_choice",
      多选: "multiple_choice",
      多选题: "multiple_choice",
      multiple: "multiple_choice",
      判断: "true_false",
      判断题: "true_false",
      简答: "short_answer",
      简答题: "short_answer",
    };
    return map[normalized] || value;
  }, z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"])),
  prompt: z.string().default(""),
  options: nullishOptional(z.array(z.object({ id: z.string(), text: z.string() }))),
  correctOptionIds: nullishOptional(z.array(z.string())),
  correctAnswer: nullishOptional(z.string()),
  points: z.coerce.number().min(1).max(100).default(1),
  difficulty: z.coerce.number().min(1).max(5).optional(),
  explanation: nullishOptional(z.string()),
});

const criterionSchema = z.object({
  name: z.string().default(""),
  description: z.string().optional(),
  maxPoints: z.coerce.number().min(1).max(100),
});

const taskDraftSchema = z.object({
  taskName: z.string().default(""),
  description: z.string().default(""),
  totalPoints: z.coerce.number().min(1).max(300).optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(240).nullable().optional(),
  draftNotes: z.string().optional(),
  quiz: optionalObject(
    z.object({
      questions: z.array(questionSchema).default([]),
      quizMode: z.enum(["fixed", "adaptive"]).default("fixed").optional(),
      showResult: z.boolean().default(true).optional(),
    }),
  ),
  subjective: optionalObject(
    z.object({
      prompt: z.string().default(""),
      requirements: z.array(z.string()).default([]),
      referenceAnswer: nullishOptional(z.string()),
      scoringCriteria: z.array(criterionSchema).default([]),
    }),
  ),
  simulation: optionalObject(
    z.object({
      scenario: z.string().default(""),
      openingLine: z.string().default(""),
      requirements: z.array(z.string()).default([]),
      scoringCriteria: z.array(criterionSchema).default([]),
      allocationSections: z
        .array(
          z.object({
            label: z.string(),
            items: z.array(z.object({ label: z.string(), defaultValue: z.coerce.number().optional() })).default([]),
          }),
        )
        .default([]),
      simPersona: z.string().default(""),
      simDialogueStyle: z.string().default(""),
      simConstraints: z.string().default(""),
    }),
  ),
});

function nullishOptional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === null ? undefined : value), schema.optional());
}

function optionalObject<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
      return undefined;
    }
    return value;
  }, schema.optional());
}

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

    const builtPrompt = buildTaskDraftFromContextPrompt({
      taskType: data.taskType,
      courseName: course.courseTitle,
      courseDescription: course.description,
      chapterName: chapter?.title || "",
      sectionName: section?.title || "",
      taskName: data.taskName,
      description: data.description,
      teacherBrief: data.teacherBrief,
      sources,
    });
    const draft = await aiGenerateJSON(
      "taskDraft",
      user.id,
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt,
      taskDraftSchema,
      1,
      { promptVersion: TASK_DRAFT_FROM_CONTEXT_PROMPT_VERSION },
    );

    if (!hasRequestedDraftSection(draft, data.taskType)) {
      return validationError("AI 返回的草稿类型不完整，请补充需求后重试，或改用题库导入");
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
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      return validationError("AI 返回格式不完整，请重试或改用题库导入", formatAiParseError(err));
    }
    return handleServiceError(err);
  }
}

function hasRequestedDraftSection(
  draft: z.infer<typeof taskDraftSchema>,
  taskType: "quiz" | "subjective" | "simulation",
) {
  if (taskType === "quiz") return Boolean(draft.quiz && draft.quiz.questions.length > 0);
  if (taskType === "subjective") {
    return Boolean(draft.subjective && (draft.subjective.prompt || draft.subjective.scoringCriteria.length > 0));
  }
  return Boolean(
    draft.simulation &&
      (draft.simulation.scenario ||
        draft.simulation.openingLine ||
        draft.simulation.scoringCriteria.length > 0),
  );
}

function formatAiParseError(err: unknown) {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }
  return err instanceof Error ? err.message : String(err);
}
