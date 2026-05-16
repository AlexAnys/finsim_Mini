import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { getCourseActorRole } from "@/lib/auth/actor-role";
import { logAuditEvent } from "@/lib/services/audit.service";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  buildCourseKnowledgeSummaryPrompt,
  COURSE_KNOWLEDGE_SUMMARY_PROMPT_VERSION,
} from "@/lib/ai/prompts/course-knowledge-summary";
import {
  buildCourseOutlinePrompt,
  COURSE_OUTLINE_PROMPT_VERSION,
} from "@/lib/ai/prompts/course-outline";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import {
  detectDocumentKind,
  extractDocumentText,
  isReadableExtractedText,
  type IngestedDocumentKind,
} from "@/lib/services/document-ingestion.service";

export { isReadableExtractedText };

const STORAGE_BASE = (process.env.FILE_STORAGE_PATH || "./public/uploads").replace(/\/+$/, "");
const AI_SOURCE_TEXT_LIMIT = 16000;

const sourceSummarySchema = z.object({
  summary: z.string().default(""),
  conceptTags: z.array(z.string()).default([]),
});

const outlineDraftSchema = z.object({
  courseGoals: z.array(z.string()).default([]),
  knowledgeObjectives: z.array(z.string()).default([]),
  skillObjectives: z.array(z.string()).default([]),
  valueObjectives: z.array(z.string()).default([]),
  assessmentRequirements: z.array(z.string()).default([]),
  chapters: z
    .array(
      z.object({
        title: z.string().default(""),
        order: z.number().optional(),
        learningGoals: z.array(z.string()).default([]),
        knowledgeObjectives: z.array(z.string()).default([]),
        skillObjectives: z.array(z.string()).default([]),
        sections: z
          .array(
            z.object({
              title: z.string().default(""),
              order: z.number().optional(),
              learningGoals: z.array(z.string()).default([]),
              knowledgeObjectives: z.array(z.string()).default([]),
              skillObjectives: z.array(z.string()).default([]),
              knowledgePoints: z.array(z.string()).default([]),
              taskSuggestions: z
                .array(
                  z.object({
                    slot: z.enum(["pre", "in", "post"]).default("in"),
                    taskType: z.enum(["quiz", "simulation", "subjective"]).default("quiz"),
                    title: z.string().default(""),
                    rationale: z.string().default(""),
                  }),
                )
                .default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  globalKnowledgePoints: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export interface CourseKnowledgeSourceListItem {
  id: string;
  courseId: string;
  chapterId: string | null;
  sectionId: string | null;
  taskId: string | null;
  taskInstanceId: string | null;
  kind: string;
  sourceType: string | null;
  tags: string[];
  fileName: string;
  status: string;
  summary: string | null;
  conceptTags: string[];
  structuredData: unknown;
  error: string | null;
  excerpt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseKnowledgeSourceForDraft {
  id: string;
  fileName: string;
  summary: string | null;
  conceptTags: string[];
  text: string;
}

export interface CourseKnowledgeSourceForStudyBuddy {
  id: string;
  fileName: string;
  scopeLevel: "taskInstance" | "task" | "section" | "chapter" | "course" | "unknown";
  scopeLabel: string;
  summary: string | null;
  conceptTags: string[];
  excerpt: string;
}

export async function assertKnowledgeSourceScope(input: {
  courseId: string;
  chapterId?: string | null;
  sectionId?: string | null;
  taskId?: string | null;
  taskInstanceId?: string | null;
}) {
  const chapterId = input.chapterId || null;
  const sectionId = input.sectionId || null;
  const taskId = input.taskId || null;
  const taskInstanceId = input.taskInstanceId || null;

  if (chapterId) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { courseId: true },
    });
    if (!chapter) throw new Error("CHAPTER_NOT_FOUND");
    if (chapter.courseId !== input.courseId) throw new Error("CHAPTER_COURSE_MISMATCH");
  }

  if (sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { courseId: true, chapterId: true },
    });
    if (!section) throw new Error("SECTION_NOT_FOUND");
    if (section.courseId !== input.courseId) throw new Error("SECTION_PARENT_MISMATCH");
    if (chapterId && section.chapterId !== chapterId) throw new Error("SECTION_PARENT_MISMATCH");
  }

  if (taskInstanceId) {
    const instance = await prisma.taskInstance.findUnique({
      where: { id: taskInstanceId },
      select: { courseId: true, chapterId: true, sectionId: true, taskId: true },
    });
    if (!instance) throw new Error("TASK_INSTANCE_NOT_FOUND");
    if (instance.courseId !== input.courseId) throw new Error("TASK_INSTANCE_SCOPE_MISMATCH");
    if (chapterId && instance.chapterId !== chapterId) throw new Error("TASK_INSTANCE_SCOPE_MISMATCH");
    if (sectionId && instance.sectionId !== sectionId) throw new Error("TASK_INSTANCE_SCOPE_MISMATCH");
    if (taskId && instance.taskId !== taskId) throw new Error("TASK_INSTANCE_SCOPE_MISMATCH");
    return;
  }

  if (taskId) {
    const scopedTask = await prisma.taskInstance.findFirst({
      where: {
        taskId,
        courseId: input.courseId,
        ...(chapterId ? { chapterId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
      select: { id: true },
    });
    if (!scopedTask) throw new Error("TASK_SCOPE_MISMATCH");
  }
}

export async function listCourseKnowledgeSources(input: {
  courseId: string;
  chapterId?: string | null;
  sectionId?: string | null;
  taskId?: string | null;
  taskInstanceId?: string | null;
  sourceType?: string | null;
  status?: string | null;
  tags?: string[];
}): Promise<CourseKnowledgeSourceListItem[]> {
  const sources = await prisma.courseKnowledgeSource.findMany({
    where: {
      courseId: input.courseId,
      ...(input.chapterId ? { chapterId: input.chapterId } : {}),
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.taskInstanceId ? { taskInstanceId: input.taskInstanceId } : {}),
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      ...(input.status ? { status: input.status as never } : {}),
      ...(input.tags && input.tags.length > 0 ? { tags: { hasEvery: input.tags } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      courseId: true,
      chapterId: true,
      sectionId: true,
      taskId: true,
      taskInstanceId: true,
      kind: true,
      sourceType: true,
      tags: true,
      fileName: true,
      status: true,
      summary: true,
      conceptTags: true,
      structuredData: true,
      error: true,
      extractedText: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return sources.map((source) => ({
    id: source.id,
    courseId: source.courseId,
    chapterId: source.chapterId,
    sectionId: source.sectionId,
    taskId: source.taskId,
    taskInstanceId: source.taskInstanceId,
    kind: source.kind,
    sourceType: source.sourceType,
    tags: source.tags,
    fileName: source.fileName,
    status: source.status,
    summary: source.summary,
    conceptTags: source.conceptTags,
    structuredData: source.structuredData,
    error: source.error,
    excerpt: makeExcerpt(source.extractedText || ""),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }));
}

export async function deleteCourseKnowledgeSource(input: {
  id: string;
  userId: string;
  role: string;
  /** Unit 5c: 协作者删 owner 上传素材需带 force=true（前端 confirm 后重发）*/
  force?: boolean;
}) {
  const source = await prisma.courseKnowledgeSource.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      courseId: true,
      filePath: true,
      teacherId: true,
      fileName: true,
    },
  });
  if (!source) throw new Error("KNOWLEDGE_SOURCE_NOT_FOUND");

  await assertCourseAccess(source.courseId, input.userId, input.role);

  // Unit 5c: actor role + owner-confirm 拦截
  const actorRole = await getCourseActorRole(
    source.courseId,
    input.userId,
    input.role,
  );
  const isOwnUpload = source.teacherId === input.userId;
  if (!isOwnUpload && !input.force && actorRole !== "admin") {
    throw new Error("KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM");
  }

  await prisma.courseKnowledgeSource.delete({ where: { id: source.id } });

  if (source.filePath) {
    await unlink(join(STORAGE_BASE, source.filePath)).catch(() => undefined);
  }

  await logAuditEvent({
    action: "course_knowledge_source.delete",
    actorRole,
    actorId: input.userId,
    targetId: source.id,
    targetType: "CourseKnowledgeSource",
    metadata: {
      courseId: source.courseId,
      fileName: source.fileName,
      ownerTeacherId: source.teacherId,
      byOwner: isOwnUpload,
      byCollaborator: !isOwnUpload && actorRole === "collaborator",
    },
  });

  return { id: source.id };
}

export async function createAndProcessCourseKnowledgeSource(input: {
  teacherId: string;
  courseId: string;
  chapterId?: string | null;
  sectionId?: string | null;
  taskId?: string | null;
  taskInstanceId?: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  sourceType?: string | null;
  tags?: string[];
}) {
  await assertKnowledgeSourceScope(input);

  const source = await prisma.courseKnowledgeSource.create({
    data: {
      teacherId: input.teacherId,
      courseId: input.courseId,
      chapterId: input.chapterId || null,
      sectionId: input.sectionId || null,
      taskId: input.taskId || null,
      taskInstanceId: input.taskInstanceId || null,
      kind: detectDocumentKind(input.fileName, input.mimeType),
      sourceType: input.sourceType || null,
      tags: sanitizeTags(input.tags),
      fileName: input.fileName,
      filePath: input.filePath,
      mimeType: input.mimeType,
      status: "uploaded",
    },
  });

  const asyncJob = await enqueueAsyncJob({
    type: "knowledge_source_ingest",
    entityType: "CourseKnowledgeSource",
    entityId: source.id,
    input: { sourceId: source.id },
    createdBy: input.teacherId,
  });

  return { ...source, asyncJob };
}

export async function retryCourseKnowledgeSource(input: {
  id: string;
  userId: string;
  role: string;
}) {
  const source = await prisma.courseKnowledgeSource.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      courseId: true,
      filePath: true,
      teacherId: true,
      status: true,
    },
  });
  if (!source) throw new Error("KNOWLEDGE_SOURCE_NOT_FOUND");

  await assertCourseAccess(source.courseId, input.userId, input.role);

  if (!source.filePath) throw new Error("KNOWLEDGE_SOURCE_NOT_RETRYABLE");

  const RETRYABLE_STATUSES = new Set([
    "ai_summary_failed",
    "failed",
    "ocr_required",
    "ready",
  ]);
  if (!RETRYABLE_STATUSES.has(source.status)) {
    throw new Error("KNOWLEDGE_SOURCE_NOT_RETRYABLE");
  }

  const updated = await prisma.courseKnowledgeSource.update({
    where: { id: source.id },
    data: { status: "uploaded", error: null },
  });

  const asyncJob = await enqueueAsyncJob({
    type: "knowledge_source_ingest",
    entityType: "CourseKnowledgeSource",
    entityId: source.id,
    input: { sourceId: source.id },
    createdBy: input.userId,
  });

  return { ...updated, asyncJob };
}

export async function processCourseKnowledgeSource(sourceId: string, userId: string) {
  await prisma.courseKnowledgeSource.update({
    where: { id: sourceId },
    data: { status: "extracting", error: null },
  });

  try {
    const source = await prisma.courseKnowledgeSource.findUnique({
      where: { id: sourceId },
    });
    if (!source || !source.filePath) throw new Error("KNOWLEDGE_SOURCE_NOT_FOUND");

    const buffer = await readFile(join(STORAGE_BASE, source.filePath));
    const extracted = await extractDocumentText({
      buffer,
      fileName: source.fileName,
      mimeType: source.mimeType,
      allowOcr: true,
    });

    await prisma.courseKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        kind: extracted.kind as IngestedDocumentKind,
        status:
          extracted.status === "ready"
            ? "processing"
            : extracted.status === "ocr_required"
              ? "ocr_required"
              : "failed",
        extractedText: extracted.text || null,
        error: extracted.error || extracted.warnings.join("；") || null,
      },
    });

    if (extracted.status === "ocr_required") throw new Error("DOCUMENT_OCR_REQUIRED");
    if (extracted.status !== "ready" || !extracted.text.trim()) throw new Error("KNOWLEDGE_SOURCE_EMPTY");

    const extractedText = extracted.text;

    let summary: string | null = null;
    let conceptTags: string[] = [];
    let structuredData: unknown = null;
    let aiError: string | null = null;

    try {
      const builtSummary = buildCourseKnowledgeSummaryPrompt({
        fileName: source.fileName,
        extractedText: extractedText.slice(0, AI_SOURCE_TEXT_LIMIT),
      });
      const result = await aiGenerateJSON(
        "taskDraft",
        userId,
        builtSummary.systemPrompt,
        builtSummary.userPrompt,
        sourceSummarySchema,
        1,
        {
          settingsUserId: userId,
          metadata: {
            sourceId,
            sourceType: source.sourceType,
            courseId: source.courseId,
          },
          promptVersion: COURSE_KNOWLEDGE_SUMMARY_PROMPT_VERSION,
        },
      );
      summary = result.summary || null;
      conceptTags = dedupeTags(result.conceptTags);
    } catch (err) {
      aiError = `AI 摘要暂不可用：${errorMessage(err)}`;
    }

    if (source.sourceType === "syllabus") {
      // M1 (PR #11) · Molly 案例：outline AI 调用因 JSON 截断（默认 8192 token）失败。
      // 策略：先 16384 token + 完整 schema 尝试一次（带 1 次内部 retry）；若仍失败 / 解
      // 出空目录（chapters.length === 0），切到 compact prompt（更短素材 + 精简 schema）
      // 再试一次。两次都拿不到非空 outline → 写 aiError → 标 ai_summary_failed，避免
      // "ready 但目录为空"的中间状态欺骗老师。
      const runOutlineAi = (compact: boolean, parserTag: string) => {
        const builtOutline = buildCourseOutlinePrompt({
          fileName: source.fileName,
          extractedText,
          compact,
        });
        return aiGenerateJSON(
          "taskDraft",
          userId,
          builtOutline.systemPrompt,
          builtOutline.userPrompt,
          outlineDraftSchema,
          1,
          {
            settingsUserId: userId,
            maxOutputTokens: 16384,
            metadata: {
              sourceId,
              sourceType: source.sourceType,
              courseId: source.courseId,
              parser: parserTag,
            },
            promptVersion: COURSE_OUTLINE_PROMPT_VERSION,
          },
        );
      };

      let firstError: unknown = null;
      let firstOutline: z.infer<typeof outlineDraftSchema> | null = null;
      try {
        firstOutline = await runOutlineAi(false, "syllabus-outline");
      } catch (err) {
        firstError = err;
      }

      // M1 r2 · ready+empty edge case：partial parse 后 schema.parse 把缺字段填成
      // `.default([])`，结果 chapters.length===0 但 aiGenerateJSON 不会 throw。老师
      // 会拿到一个 ready 的空目录。这里显式当作失败，触发 compact retry。
      const firstChapterCount =
        firstOutline && Array.isArray(firstOutline.chapters)
          ? firstOutline.chapters.length
          : 0;

      if (firstOutline && firstChapterCount > 0) {
        structuredData = firstOutline;
      } else {
        try {
          const retried = await runOutlineAi(true, "syllabus-outline-compact-retry");
          const retriedChapterCount = Array.isArray(retried?.chapters)
            ? retried.chapters.length
            : 0;
          if (retriedChapterCount > 0) {
            structuredData = retried;
          } else {
            // compact retry 也回来空目录 → 这条素材 LLM 当前能力下解析不出结构，
            // 标 ai_summary_failed 让老师走「重新 AI 解析」或换素材，不要把空目录
            // 当成功 commit 到 DB。
            aiError = [
              aiError,
              firstError
                ? `课程大纲解析暂不可用：${errorMessage(firstError)}`
                : "课程大纲解析暂不可用：AI 未能从素材中提取出章节结构，请检查素材内容或重试。",
            ]
              .filter(Boolean)
              .join("；");
          }
        } catch (retryErr) {
          aiError = [aiError, `课程大纲解析暂不可用：${errorMessage(retryErr)}`]
            .filter(Boolean)
            .join("；");
        }
      }
    }

    return prisma.courseKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: aiError ? "ai_summary_failed" : "ready",
        extractedText,
        summary,
        conceptTags,
        structuredData: structuredData as never,
        error: aiError,
      },
    });
  } catch (err) {
    await prisma.courseKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: errorMessage(err) === "DOCUMENT_OCR_REQUIRED" ? "ocr_required" : "failed",
        error: errorMessage(err),
      },
    });
    throw err;
  }
}

export async function getKnowledgeSourcesForDraft(input: {
  courseId: string;
  sourceIds: string[];
}): Promise<CourseKnowledgeSourceForDraft[]> {
  if (input.sourceIds.length === 0) return [];

  const sources = await prisma.courseKnowledgeSource.findMany({
    where: {
      id: { in: input.sourceIds },
      courseId: input.courseId,
      status: { in: ["ready", "ai_summary_failed"] },
    },
    select: {
      id: true,
      fileName: true,
      summary: true,
      conceptTags: true,
      extractedText: true,
    },
  });

  if (sources.length !== input.sourceIds.length) {
    throw new Error("KNOWLEDGE_SOURCE_NOT_FOUND");
  }

  return sources.map((source) => ({
    id: source.id,
    fileName: source.fileName,
    summary: source.summary,
    conceptTags: source.conceptTags,
    text: source.extractedText || "",
  }));
}

export async function getKnowledgeSourcesForStudyBuddy(input: {
  courseId?: string | null;
  chapterId?: string | null;
  sectionId?: string | null;
  taskId?: string | null;
  taskInstanceId?: string | null;
}): Promise<CourseKnowledgeSourceForStudyBuddy[]> {
  if (!input.courseId) return [];

  const scopeOr = [
    { chapterId: null, sectionId: null, taskId: null, taskInstanceId: null },
    ...(input.chapterId
      ? [{ chapterId: input.chapterId, sectionId: null, taskId: null, taskInstanceId: null }]
      : []),
    ...(input.sectionId ? [{ sectionId: input.sectionId, taskId: null, taskInstanceId: null }] : []),
    ...(input.taskId ? [{ taskId: input.taskId, taskInstanceId: null }] : []),
    ...(input.taskInstanceId ? [{ taskInstanceId: input.taskInstanceId }] : []),
  ];

  const sources = await prisma.courseKnowledgeSource.findMany({
    where: {
      courseId: input.courseId,
      status: { in: ["ready", "ai_summary_failed"] },
      OR: scopeOr,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      chapterId: true,
      sectionId: true,
      taskId: true,
      taskInstanceId: true,
      fileName: true,
      summary: true,
      conceptTags: true,
      extractedText: true,
      updatedAt: true,
    },
  });

  const priority: Record<CourseKnowledgeSourceForStudyBuddy["scopeLevel"], number> = {
    taskInstance: 0,
    task: 1,
    section: 2,
    chapter: 3,
    course: 4,
    unknown: 5,
  };

  return sources
    .map((source) => {
      const scopeLevel = getStudyBuddyScopeLevel(source);
      return {
        id: source.id,
        fileName: source.fileName,
        scopeLevel,
        scopeLabel: scopeLevelLabel(scopeLevel),
        summary: source.summary,
        conceptTags: source.conceptTags,
        excerpt: makeExcerpt((source.extractedText || "").slice(0, 3000)),
        updatedAt: source.updatedAt,
      };
    })
    .sort((a, b) => {
      const byPriority = priority[a.scopeLevel] - priority[b.scopeLevel];
      if (byPriority !== 0) return byPriority;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, 6)
    .map((source) => ({
      id: source.id,
      fileName: source.fileName,
      scopeLevel: source.scopeLevel,
      scopeLabel: source.scopeLabel,
      summary: source.summary,
      conceptTags: source.conceptTags,
      excerpt: source.excerpt,
    }));
}

function dedupeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}

function sanitizeTags(tags?: string[]) {
  if (!tags) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
}

function getStudyBuddyScopeLevel(source: {
  chapterId: string | null;
  sectionId: string | null;
  taskId: string | null;
  taskInstanceId: string | null;
}): CourseKnowledgeSourceForStudyBuddy["scopeLevel"] {
  if (source.taskInstanceId) return "taskInstance";
  if (source.taskId) return "task";
  if (source.sectionId) return "section";
  if (source.chapterId) return "chapter";
  if (!source.chapterId && !source.sectionId && !source.taskId && !source.taskInstanceId) {
    return "course";
  }
  return "unknown";
}

function scopeLevelLabel(scopeLevel: CourseKnowledgeSourceForStudyBuddy["scopeLevel"]) {
  switch (scopeLevel) {
    case "taskInstance":
      return "本次任务";
    case "task":
      return "任务模板";
    case "section":
      return "小节";
    case "chapter":
      return "章节";
    case "course":
      return "课程";
    default:
      return "上下文";
  }
}

function makeExcerpt(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
