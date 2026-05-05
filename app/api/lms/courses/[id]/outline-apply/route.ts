import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";

const requestSchema = z.object({
  sourceId: z.string().uuid(),
  mode: z.enum(["preview", "apply"]).default("preview"),
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
    const preview = buildOutlineDiff(outline.data, current);
    if (parsed.data.mode === "preview") {
      return success({ sourceId: source.id, fileName: source.fileName, outline: outline.data, preview });
    }

    const applied = await prisma.$transaction(async (tx) => {
      const refreshed = await loadCourseStructure(courseId, tx);
      const createdChapters: Array<{ id: string; title: string }> = [];
      const createdSections: Array<{ id: string; chapterTitle: string; title: string }> = [];
      let nextChapterOrder =
        Math.max(0, ...refreshed.chapters.map((chapter) => chapter.order)) + 1;
      const chapterByKey = new Map(refreshed.chapters.map((chapter) => [normalizeTitle(chapter.title), chapter]));

      for (const draftChapter of outline.data.chapters) {
        const title = draftChapter.title.trim();
        if (!title) continue;
        let chapter = chapterByKey.get(normalizeTitle(title));
        if (!chapter) {
          chapter = await tx.chapter.create({
            data: {
              courseId,
              title,
              order: nextChapterOrder++,
              createdBy: user.id,
            },
            include: { sections: { include: { taskInstances: { select: { id: true } } } }, taskInstances: { select: { id: true } } },
          });
          chapterByKey.set(normalizeTitle(title), chapter);
          createdChapters.push({ id: chapter.id, title: chapter.title });
        }

        let nextSectionOrder =
          Math.max(0, ...chapter.sections.map((section) => section.order)) + 1;
        const sectionByKey = new Map(chapter.sections.map((section) => [normalizeTitle(section.title), section]));
        for (const draftSection of draftChapter.sections) {
          const sectionTitle = draftSection.title.trim();
          if (!sectionTitle || sectionByKey.has(normalizeTitle(sectionTitle))) continue;
          const created = await tx.section.create({
            data: {
              courseId,
              chapterId: chapter.id,
              title: sectionTitle,
              order: nextSectionOrder++,
              createdBy: user.id,
            },
            include: { taskInstances: { select: { id: true } } },
          });
          chapter.sections.push(created);
          sectionByKey.set(normalizeTitle(sectionTitle), created);
          createdSections.push({ id: created.id, chapterTitle: chapter.title, title: created.title });
        }
      }

      await tx.courseKnowledgeSource.update({
        where: { id: source.id },
        data: { structuredData: outline.data as never },
      });

      return {
        createdChapters,
        createdSections,
        preview: buildOutlineDiff(outline.data, await loadCourseStructure(courseId, tx)),
      };
    });

    return success({ sourceId: source.id, fileName: source.fileName, outline: outline.data, applied });
  } catch (err) {
    return handleServiceError(err);
  }
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

function buildOutlineDiff(
  outline: z.infer<typeof outlineDraftSchema>,
  current: Awaited<ReturnType<typeof loadCourseStructure>>,
) {
  const existingChapters = new Map(current.chapters.map((chapter) => [normalizeTitle(chapter.title), chapter]));
  const chaptersToAdd: Array<{ title: string; sectionCount: number }> = [];
  const sectionsToAdd: Array<{ chapterTitle: string; title: string }> = [];

  for (const draftChapter of outline.chapters) {
    const title = draftChapter.title.trim();
    if (!title) continue;
    const existingChapter = existingChapters.get(normalizeTitle(title));
    if (!existingChapter) {
      chaptersToAdd.push({ title, sectionCount: draftChapter.sections.filter((section) => section.title.trim()).length });
      continue;
    }
    const existingSections = new Set(existingChapter.sections.map((section) => normalizeTitle(section.title)));
    for (const draftSection of draftChapter.sections) {
      const sectionTitle = draftSection.title.trim();
      if (sectionTitle && !existingSections.has(normalizeTitle(sectionTitle))) {
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
    ],
  };
}

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, "").toLowerCase();
}
