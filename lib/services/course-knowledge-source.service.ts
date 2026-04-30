import { readFile } from "fs/promises";
import { join } from "path";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";

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

export async function assertKnowledgeSourceScope(input: {
  courseId: string;
  chapterId?: string | null;
  sectionId?: string | null;
}) {
  const chapterId = input.chapterId || null;
  const sectionId = input.sectionId || null;

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
}

export async function listCourseKnowledgeSources(input: {
  courseId: string;
  chapterId?: string | null;
  sectionId?: string | null;
}): Promise<CourseKnowledgeSourceListItem[]> {
  const sources = await prisma.courseKnowledgeSource.findMany({
    where: {
      courseId: input.courseId,
      ...(input.chapterId ? { chapterId: input.chapterId } : {}),
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      courseId: true,
      chapterId: true,
      sectionId: true,
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
      fileName: input.fileName,
      filePath: input.filePath,
      mimeType: input.mimeType,
      status: "uploaded",
    },
  });

  return processCourseKnowledgeSource(source.id, input.teacherId);
}

export async function processCourseKnowledgeSource(sourceId: string, userId: string) {
  await prisma.courseKnowledgeSource.update({
    where: { id: sourceId },
    data: { status: "processing", error: null },
  });

  try {
    const source = await prisma.courseKnowledgeSource.findUnique({
      where: { id: sourceId },
    });
    if (!source || !source.filePath) throw new Error("KNOWLEDGE_SOURCE_NOT_FOUND");

    const extractedText = await extractSourceText(source.filePath, source.fileName);
    if (!extractedText.trim()) throw new Error("KNOWLEDGE_SOURCE_EMPTY");

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
        status: "ready",
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
        status: "failed",
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
      status: "ready",
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

async function extractSourceText(filePath: string, fileName: string) {
  const buffer = await readFile(join(STORAGE_BASE, filePath));

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return buffer.toString("utf-8").trim();
  }

  try {
    const pdf = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await pdf.getText();
      const text = result.text.trim();
      if (isReadableExtractedText(text)) return text;
      throw new Error("KNOWLEDGE_SOURCE_UNREADABLE");
    } finally {
      await pdf.destroy();
    }
  } catch {
    const fallbackText = buffer
      .toString("utf-8")
      .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (isReadableExtractedText(fallbackText)) return fallbackText;
    throw new Error("KNOWLEDGE_SOURCE_UNREADABLE");
  }
}

export function isReadableExtractedText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 20) return false;
  if (/^%PDF-\d/.test(normalized)) return false;

  const artifactPatterns = [
    /\bobj\b/i,
    /\bendobj\b/i,
    /\bxref\b/i,
    /\btrailer\b/i,
    /\/Type\b/i,
    /\/Filter\b/i,
    /\/Length\b/i,
    /\bstream\b/i,
    /\bendstream\b/i,
  ];
  const artifactHits = artifactPatterns.reduce(
    (count, pattern) => count + (pattern.test(normalized) ? 1 : 0),
    0,
  );
  if (artifactHits >= 3) return false;

  const readableChars =
    normalized.match(/[A-Za-z0-9\u4e00-\u9fff，。！？；、（）《》：,.!?;:()[\]\s-]/g)
      ?.length || 0;
  return readableChars / normalized.length > 0.55;
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
