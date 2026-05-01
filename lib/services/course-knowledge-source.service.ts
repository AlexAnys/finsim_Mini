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

export interface CourseKnowledgeSourceListItem {
  id: string;
  courseId: string;
  chapterId: string | null;
  sectionId: string | null;
  taskId: string | null;
  taskInstanceId: string | null;
  fileName: string;
  status: string;
  summary: string | null;
  conceptTags: string[];
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
}): Promise<CourseKnowledgeSourceListItem[]> {
  const sources = await prisma.courseKnowledgeSource.findMany({
    where: {
      courseId: input.courseId,
      ...(input.chapterId ? { chapterId: input.chapterId } : {}),
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.taskInstanceId ? { taskInstanceId: input.taskInstanceId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      courseId: true,
      chapterId: true,
      sectionId: true,
      taskId: true,
      taskInstanceId: true,
      fileName: true,
      status: true,
      summary: true,
      conceptTags: true,
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
    fileName: source.fileName,
    status: source.status,
    summary: source.summary,
    conceptTags: source.conceptTags,
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
      );
      summary = result.summary || null;
      conceptTags = dedupeTags(result.conceptTags);
    } catch (err) {
      aiError = `AI 摘要暂不可用：${errorMessage(err)}`;
    }

    return prisma.courseKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: aiError ? "ai_summary_failed" : "ready",
        extractedText,
        summary,
        conceptTags,
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
    { chapterId: null, sectionId: null },
    ...(input.chapterId
      ? [{ chapterId: input.chapterId, sectionId: null }]
      : []),
    ...(input.sectionId ? [{ sectionId: input.sectionId }] : []),
    ...(input.taskId ? [{ taskId: input.taskId }] : []),
    ...(input.taskInstanceId ? [{ taskInstanceId: input.taskInstanceId }] : []),
  ];

  const sources = await prisma.courseKnowledgeSource.findMany({
    where: {
      courseId: input.courseId,
      status: { in: ["ready", "ai_summary_failed"] },
      OR: scopeOr,
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: {
      id: true,
      fileName: true,
      summary: true,
      conceptTags: true,
      extractedText: true,
    },
  });

  return sources.map((source) => ({
    id: source.id,
    fileName: source.fileName,
    summary: source.summary,
    conceptTags: source.conceptTags,
    excerpt: makeExcerpt((source.extractedText || "").slice(0, 3000)),
  }));
}

function dedupeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}

function makeExcerpt(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
