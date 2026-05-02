import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
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
  chapters: z
    .array(
      z.object({
        title: z.string().default(""),
        order: z.number().optional(),
        sections: z
          .array(
            z.object({
              title: z.string().default(""),
              order: z.number().optional(),
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
      const result = await aiGenerateJSON(
        "taskDraft",
        userId,
        "你是一位中高职课程教研助手。请把课程素材整理成教师可复核的摘要和概念标签。",
        `文件名: ${source.fileName}

请阅读以下课程素材文本，返回 JSON：
{
  "summary": "用 3-5 句话概括素材覆盖的知识点、题型线索和教学目标",
  "conceptTags": ["核心概念1", "核心概念2"]
}

要求：
- conceptTags 只写素材涉及概念，不要断定学生弱点。
- 面向中高职教学，避免 MBA/投行等不相干语境。

素材文本：
${extractedText.slice(0, AI_SOURCE_TEXT_LIMIT)}`,
        sourceSummarySchema,
        1,
        {
          settingsUserId: userId,
          metadata: {
            sourceId,
            sourceType: source.sourceType,
            courseId: source.courseId,
          },
        },
      );
      summary = result.summary || null;
      conceptTags = dedupeTags(result.conceptTags);
    } catch (err) {
      aiError = `AI 摘要暂不可用：${errorMessage(err)}`;
    }

    if (source.sourceType === "syllabus") {
      try {
        structuredData = await aiGenerateJSON(
          "taskDraft",
          userId,
          "你是一位中高职课程负责人。请只生成可供教师审核的课程目录草稿，不要直接写入系统。",
          `文件名: ${source.fileName}

请阅读课程大纲或课程整体内容，返回 JSON：
{
  "chapters": [
    {
      "title": "章节标题",
      "order": 0,
      "sections": [
        {
          "title": "小节标题",
          "order": 0,
          "knowledgePoints": ["知识点"],
          "taskSuggestions": [
            {
              "slot": "pre|in|post",
              "taskType": "quiz|simulation|subjective",
              "title": "建议任务标题",
              "rationale": "为什么适合这里"
            }
          ]
        }
      ]
    }
  ],
  "globalKnowledgePoints": ["课程级知识点"],
  "notes": "需要教师确认或补充的地方"
}

要求：
- 只做草稿，不要声称已经改写课程结构。
- 章节、小节和知识点要面向中高职课堂，不要使用 MBA/投行语境。
- taskSuggestions 只给少量高价值建议，slot 必须是 pre/in/post。

素材文本：
${extractedText.slice(0, AI_SOURCE_TEXT_LIMIT)}`,
          outlineDraftSchema,
          1,
          {
            settingsUserId: userId,
            metadata: {
              sourceId,
              sourceType: source.sourceType,
              courseId: source.courseId,
              parser: "syllabus-outline",
            },
          },
        );
      } catch (err) {
        aiError = [aiError, `课程大纲解析暂不可用：${errorMessage(err)}`]
          .filter(Boolean)
          .join("；");
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
