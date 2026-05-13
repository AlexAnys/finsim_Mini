import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { handleServiceError, success, validationError, error } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

const requestSchema = z.object({
  sourceId: z.string().uuid(),
  mode: z.enum(["preview", "save-draft", "apply", "replace"]).default("preview"),
  outline: z.unknown().optional(),
});

const textArraySchema = z
  .array(z.string())
  .default([])
  .catch([]);

const taskSuggestionSchema = z.union([
  z.string(),
  z.object({
    slot: z.enum(["pre", "in", "post"]).default("in").catch("in"),
    taskType: z.enum(["quiz", "simulation", "subjective"]).default("quiz").catch("quiz"),
    title: z.string().default(""),
    rationale: z.string().default(""),
  }),
]);

const outlineSectionSchema = z.object({
  sectionId: z.string().uuid().optional(),
  title: z.string().default(""),
  learningGoals: textArraySchema,
  knowledgeObjectives: textArraySchema,
  skillObjectives: textArraySchema,
  knowledgePoints: textArraySchema,
  taskSuggestions: z.array(taskSuggestionSchema).default([]).catch([]),
});

const outlineDraftSchema = z.object({
  courseGoals: textArraySchema,
  knowledgeObjectives: textArraySchema,
  skillObjectives: textArraySchema,
  valueObjectives: textArraySchema,
  assessmentRequirements: textArraySchema,
  globalKnowledgePoints: textArraySchema,
  notes: z.string().default("").catch(""),
  chapters: z
    .array(
      z.object({
        chapterId: z.string().uuid().optional(),
        title: z.string().default(""),
        learningGoals: textArraySchema,
        knowledgeObjectives: textArraySchema,
        skillObjectives: textArraySchema,
        knowledgePoints: textArraySchema,
        sections: z.array(outlineSectionSchema).default([]),
      }),
    )
    .default([]),
});

type OutlineDraft = z.infer<typeof outlineDraftSchema>;
type LoadedStructure = Awaited<ReturnType<typeof loadCourseStructure>>;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id: courseId } = await params;
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return validationError("请求参数错误", parsed.error.flatten());

    const user = result.session.user;
    await assertCourseAccess(courseId, user.id, user.role);

    const source = await prisma.courseKnowledgeSource.findFirst({
      where: {
        id: parsed.data.sourceId,
        courseId,
        sourceType: "syllabus",
        status: { in: ["ready", "ai_summary_failed"] },
      },
      select: { id: true, fileName: true, structuredData: true },
    });
    if (!source) throw new Error("KNOWLEDGE_SOURCE_NOT_FOUND");

    const outlineSource = parsed.data.outline || source.structuredData || {};
    const outline = outlineDraftSchema.safeParse(outlineSource);
    if (!outline.success || outline.data.chapters.length === 0) {
      return validationError("该素材还没有可应用的 AI 目录结构");
    }

    const current = await loadCourseStructure(courseId);

    if (parsed.data.mode === "preview") {
      const preview = buildOutlineDiff(outline.data, current);
      return success({ sourceId: source.id, fileName: source.fileName, outline: outline.data, preview });
    }

    if (parsed.data.mode === "save-draft") {
      await prisma.courseKnowledgeSource.update({
        where: { id: source.id },
        data: { structuredData: outline.data as unknown as Prisma.InputJsonValue },
      });
      const preview = buildOutlineDiff(outline.data, current);
      return success({ sourceId: source.id, fileName: source.fileName, outline: outline.data, preview });
    }

    if (parsed.data.mode === "replace") {
      const block = findReplaceBlockers(outline.data, current);
      if (block) {
        return error("OUTLINE_REPLACE_BLOCKED", block, 400);
      }
    }

    const applied = await prisma.$transaction(async (tx) => {
      const refreshed = await loadCourseStructure(courseId, tx);
      if (parsed.data.mode === "replace") {
        return applyReplace(tx, courseId, user.id, outline.data, refreshed, source.id);
      }
      return applySafeMerge(tx, courseId, user.id, outline.data, refreshed, source.id);
    });

    return success({ sourceId: source.id, fileName: source.fileName, outline: applied.outline, applied });
  } catch (err) {
    return handleServiceError(err);
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function applySafeMerge(
  tx: Tx,
  courseId: string,
  userId: string,
  draft: OutlineDraft,
  refreshed: LoadedStructure,
  sourceId: string,
) {
  const createdChapters: Array<{ id: string; title: string }> = [];
  const createdSections: Array<{ id: string; chapterTitle: string; title: string }> = [];
  let nextChapterOrder = Math.max(0, ...refreshed.chapters.map((chapter) => chapter.order)) + 1;
  const chapterByKey = new Map(refreshed.chapters.map((chapter) => [normalizeTitle(chapter.title), chapter]));
  const outlineWithIds: OutlineDraft = { ...draft, chapters: [] };

  for (const draftChapter of draft.chapters) {
    const title = draftChapter.title.trim();
    if (!title) continue;
    let chapter = chapterByKey.get(normalizeTitle(title));
    if (!chapter) {
      chapter = await tx.chapter.create({
        data: {
          courseId,
          title,
          order: nextChapterOrder++,
          createdBy: userId,
        },
        include: {
          sections: { include: { taskInstances: { select: { id: true } } } },
          taskInstances: { select: { id: true } },
        },
      });
      chapterByKey.set(normalizeTitle(title), chapter);
      createdChapters.push({ id: chapter.id, title: chapter.title });
    }

    let nextSectionOrder = Math.max(0, ...chapter.sections.map((section) => section.order)) + 1;
    const sectionByKey = new Map(chapter.sections.map((section) => [normalizeTitle(section.title), section]));
    const updatedSections: typeof draftChapter.sections = [];
    for (const draftSection of draftChapter.sections) {
      const sectionTitle = draftSection.title.trim();
      if (!sectionTitle) {
        updatedSections.push(draftSection);
        continue;
      }
      const existing = sectionByKey.get(normalizeTitle(sectionTitle));
      if (existing) {
        updatedSections.push({ ...draftSection, sectionId: existing.id });
        continue;
      }
      const created = await tx.section.create({
        data: {
          courseId,
          chapterId: chapter.id,
          title: sectionTitle,
          order: nextSectionOrder++,
          createdBy: userId,
        },
        include: { taskInstances: { select: { id: true } } },
      });
      chapter.sections.push(created);
      sectionByKey.set(normalizeTitle(sectionTitle), created);
      createdSections.push({ id: created.id, chapterTitle: chapter.title, title: created.title });
      updatedSections.push({ ...draftSection, sectionId: created.id });
    }
    outlineWithIds.chapters.push({ ...draftChapter, chapterId: chapter.id, sections: updatedSections });
  }

  await tx.courseKnowledgeSource.update({
    where: { id: sourceId },
    data: { structuredData: outlineWithIds as unknown as Prisma.InputJsonValue },
  });

  return {
    mode: "apply" as const,
    createdChapters,
    createdSections,
    updatedChapters: [],
    updatedSections: [],
    deletedChapters: [],
    deletedSections: [],
    outline: outlineWithIds,
    preview: buildOutlineDiff(outlineWithIds, await loadCourseStructure(courseId, tx)),
  };
}

async function applyReplace(
  tx: Tx,
  courseId: string,
  userId: string,
  draft: OutlineDraft,
  refreshed: LoadedStructure,
  sourceId: string,
) {
  const createdChapters: Array<{ id: string; title: string }> = [];
  const createdSections: Array<{ id: string; chapterTitle: string; title: string }> = [];
  const updatedChapters: Array<{ id: string; title: string }> = [];
  const updatedSections: Array<{ id: string; chapterTitle: string; title: string }> = [];
  const deletedChapters: Array<{ id: string; title: string }> = [];
  const deletedSections: Array<{ id: string; chapterTitle: string; title: string }> = [];

  const draftChapterIds = new Set(
    draft.chapters
      .map((chapter) => chapter.chapterId)
      .filter((value): value is string => typeof value === "string"),
  );

  // Delete chapters no longer in draft (already validated as task-free before transaction).
  for (const existing of refreshed.chapters) {
    if (!draftChapterIds.has(existing.id)) {
      await tx.chapter.delete({ where: { id: existing.id } });
      deletedChapters.push({ id: existing.id, title: existing.title });
    }
  }

  const existingChapterMap = new Map(refreshed.chapters.map((chapter) => [chapter.id, chapter]));

  // Phase 1: bump every kept chapter's order to a temp value to avoid @@unique conflicts.
  const tempOffset = (refreshed.chapters.length + draft.chapters.length + 10) * 10;
  for (let i = 0; i < refreshed.chapters.length; i++) {
    const existing = refreshed.chapters[i];
    if (draftChapterIds.has(existing.id)) {
      await tx.chapter.update({
        where: { id: existing.id },
        data: { order: tempOffset + i },
      });
    }
  }

  const outlineWithIds: OutlineDraft = { ...draft, chapters: [] };

  // Phase 2: apply final order, titles, and section diffs.
  for (let index = 0; index < draft.chapters.length; index++) {
    const draftChapter = draft.chapters[index];
    const title = draftChapter.title.trim();
    if (!title) continue;

    let chapter:
      | (LoadedStructure["chapters"][number])
      | null = null;
    if (draftChapter.chapterId && existingChapterMap.has(draftChapter.chapterId)) {
      const existing = existingChapterMap.get(draftChapter.chapterId)!;
      const titleChanged = existing.title !== title;
      await tx.chapter.update({
        where: { id: existing.id },
        data: { order: index, title },
      });
      chapter = { ...existing, title, order: index };
      if (titleChanged) updatedChapters.push({ id: chapter.id, title });
    } else {
      const created = await tx.chapter.create({
        data: { courseId, title, order: index, createdBy: userId },
        include: {
          sections: { include: { taskInstances: { select: { id: true } } } },
          taskInstances: { select: { id: true } },
        },
      });
      chapter = created;
      createdChapters.push({ id: created.id, title });
    }

    const existingSectionMap = new Map(chapter.sections.map((section) => [section.id, section]));
    const draftSectionIds = new Set(
      draftChapter.sections
        .map((section) => section.sectionId)
        .filter((value): value is string => typeof value === "string"),
    );

    for (const existingSection of chapter.sections) {
      if (!draftSectionIds.has(existingSection.id)) {
        await tx.section.delete({ where: { id: existingSection.id } });
        deletedSections.push({
          id: existingSection.id,
          chapterTitle: chapter.title,
          title: existingSection.title,
        });
      }
    }

    const sectionTempOffset = (chapter.sections.length + draftChapter.sections.length + 10) * 10;
    for (let s = 0; s < chapter.sections.length; s++) {
      const existing = chapter.sections[s];
      if (draftSectionIds.has(existing.id)) {
        await tx.section.update({
          where: { id: existing.id },
          data: { order: sectionTempOffset + s },
        });
      }
    }

    const updatedSectionsList: typeof draftChapter.sections = [];
    for (let sIndex = 0; sIndex < draftChapter.sections.length; sIndex++) {
      const draftSection = draftChapter.sections[sIndex];
      const sectionTitle = draftSection.title.trim();
      if (!sectionTitle) {
        updatedSectionsList.push(draftSection);
        continue;
      }
      if (draftSection.sectionId && existingSectionMap.has(draftSection.sectionId)) {
        const existing = existingSectionMap.get(draftSection.sectionId)!;
        const titleChanged = existing.title !== sectionTitle;
        await tx.section.update({
          where: { id: existing.id },
          data: { order: sIndex, title: sectionTitle },
        });
        updatedSectionsList.push({ ...draftSection, sectionId: existing.id });
        if (titleChanged) {
          updatedSections.push({ id: existing.id, chapterTitle: chapter.title, title: sectionTitle });
        }
      } else {
        const created = await tx.section.create({
          data: {
            courseId,
            chapterId: chapter.id,
            title: sectionTitle,
            order: sIndex,
            createdBy: userId,
          },
          include: { taskInstances: { select: { id: true } } },
        });
        createdSections.push({ id: created.id, chapterTitle: chapter.title, title: created.title });
        updatedSectionsList.push({ ...draftSection, sectionId: created.id });
      }
    }

    outlineWithIds.chapters.push({
      ...draftChapter,
      chapterId: chapter.id,
      sections: updatedSectionsList,
    });
  }

  await tx.courseKnowledgeSource.update({
    where: { id: sourceId },
    data: { structuredData: outlineWithIds as unknown as Prisma.InputJsonValue },
  });

  return {
    mode: "replace" as const,
    createdChapters,
    createdSections,
    updatedChapters,
    updatedSections,
    deletedChapters,
    deletedSections,
    outline: outlineWithIds,
    preview: buildOutlineDiff(outlineWithIds, await loadCourseStructure(courseId, tx)),
  };
}

function findReplaceBlockers(draft: OutlineDraft, current: LoadedStructure): string | null {
  const draftChapterIds = new Set(
    draft.chapters
      .map((chapter) => chapter.chapterId)
      .filter((value): value is string => typeof value === "string"),
  );
  for (const existing of current.chapters) {
    if (!draftChapterIds.has(existing.id)) {
      const chapterTasks = existing.taskInstances.length;
      const sectionTasks = existing.sections.reduce((sum, section) => sum + section.taskInstances.length, 0);
      const total = chapterTasks + sectionTasks;
      if (total > 0) {
        return `章节「${existing.title}」下还有 ${total} 个任务，请先删除任务后再删除该章节。`;
      }
    } else {
      const matched = draft.chapters.find((chapter) => chapter.chapterId === existing.id);
      const draftSectionIds = new Set(
        (matched?.sections || [])
          .map((section) => section.sectionId)
          .filter((value): value is string => typeof value === "string"),
      );
      for (const section of existing.sections) {
        if (!draftSectionIds.has(section.id) && section.taskInstances.length > 0) {
          return `小节「${existing.title} / ${section.title}」还有 ${section.taskInstances.length} 个任务，请先删除任务后再删除该小节。`;
        }
      }
    }
  }
  return null;
}

async function loadCourseStructure(
  courseId: string,
  tx: Pick<typeof prisma, "chapter"> = prisma,
) {
  const chapters = await tx.chapter.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      taskInstances: { select: { id: true } },
      sections: {
        orderBy: { order: "asc" },
        include: { taskInstances: { select: { id: true } } },
      },
    },
  });
  return { chapters };
}

function buildOutlineDiff(outline: OutlineDraft, current: LoadedStructure) {
  const existingChaptersByKey = new Map(
    current.chapters.map((chapter) => [normalizeTitle(chapter.title), chapter]),
  );
  const existingChaptersById = new Map(current.chapters.map((chapter) => [chapter.id, chapter]));
  const chaptersToAdd: Array<{ title: string; sectionCount: number }> = [];
  const sectionsToAdd: Array<{ chapterTitle: string; title: string }> = [];

  for (const draftChapter of outline.chapters) {
    const title = draftChapter.title.trim();
    if (!title) continue;
    const existingChapter =
      (draftChapter.chapterId && existingChaptersById.get(draftChapter.chapterId)) ||
      existingChaptersByKey.get(normalizeTitle(title));
    if (!existingChapter) {
      chaptersToAdd.push({
        title,
        sectionCount: draftChapter.sections.filter((section) => section.title.trim()).length,
      });
      continue;
    }
    const existingSectionsByKey = new Set(
      existingChapter.sections.map((section) => normalizeTitle(section.title)),
    );
    const existingSectionsById = new Set(existingChapter.sections.map((section) => section.id));
    for (const draftSection of draftChapter.sections) {
      const sectionTitle = draftSection.title.trim();
      if (!sectionTitle) continue;
      const isExisting =
        (draftSection.sectionId && existingSectionsById.has(draftSection.sectionId)) ||
        existingSectionsByKey.has(normalizeTitle(sectionTitle));
      if (!isExisting) {
        sectionsToAdd.push({ chapterTitle: existingChapter.title, title: sectionTitle });
      }
    }
  }

  const protectedItems = current.chapters
    .flatMap((chapter) => [
      ...(chapter.taskInstances.length > 0
        ? [{ type: "chapter", title: chapter.title, reason: `已有 ${chapter.taskInstances.length} 个任务` }]
        : []),
      ...chapter.sections
        .filter((section) => section.taskInstances.length > 0)
        .map((section) => ({
          type: "section",
          title: `${chapter.title} / ${section.title}`,
          reason: `已有 ${section.taskInstances.length} 个任务`,
        })),
    ])
    .slice(0, 12);

  return {
    chaptersToAdd,
    sectionsToAdd,
    protectedItems,
    notes: [
      "安全合并只新增缺失章节和小节。",
      "不会删除、重命名或覆盖已有章节、小节、任务和提交。",
      "学习目标、知识目标和任务建议会保留在该大纲素材中，后续出题可继续引用。",
      "替换模式会按当前草稿覆盖章节顺序、标题和层级；有任务的章节/小节会被保护，无法删除。",
    ],
  };
}

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, "").toLowerCase();
}
