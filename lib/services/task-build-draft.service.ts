import { Prisma, SlotType, TaskBuildDraftStatus, TaskType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface TaskBuildDraftInput {
  courseId: string;
  chapterId?: string | null;
  sectionId?: string | null;
  slot?: SlotType | null;
  taskType: TaskType;
  title?: string | null;
  description?: string | null;
  status?: TaskBuildDraftStatus;
  progress?: number;
  sourceIds?: string[];
  asyncJobId?: string | null;
  missingFields?: string[];
  draftPayload?: Prisma.InputJsonValue;
  error?: string | null;
}

export async function listTaskBuildDrafts(courseId: string) {
  const drafts = await prisma.taskBuildDraft.findMany({
    where: { courseId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const jobIds = Array.from(
    new Set(drafts.map((draft) => draft.asyncJobId).filter(Boolean) as string[]),
  );
  if (jobIds.length === 0) return drafts;

  const jobs = await prisma.asyncJob.findMany({
    where: { id: { in: jobIds } },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
      error: true,
      updatedAt: true,
    },
  });
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  return drafts.map((draft) => ({
    ...draft,
    asyncJob: draft.asyncJobId ? (jobMap.get(draft.asyncJobId) ?? null) : null,
  }));
}

export async function createTaskBuildDraft(
  createdBy: string,
  input: TaskBuildDraftInput,
) {
  await assertDraftScope(input);

  return prisma.taskBuildDraft.create({
    data: {
      courseId: input.courseId,
      chapterId: input.chapterId ?? null,
      sectionId: input.sectionId ?? null,
      slot: input.slot ?? null,
      taskType: input.taskType,
      title: normalizeTitle(input.title),
      description: normalizeOptionalText(input.description),
      status: input.status ?? "draft",
      progress: clampProgress(input.progress),
      sourceIds: input.sourceIds ?? [],
      asyncJobId: input.asyncJobId || null,
      missingFields: input.missingFields ?? [],
      draftPayload: input.draftPayload ?? Prisma.JsonNull,
      error: normalizeOptionalText(input.error),
      createdBy,
    },
  });
}

export async function getTaskBuildDraft(draftId: string) {
  const draft = await prisma.taskBuildDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) throw new Error("TASK_BUILD_DRAFT_NOT_FOUND");

  if (!draft.asyncJobId) return draft;
  const asyncJob = await prisma.asyncJob.findUnique({
    where: { id: draft.asyncJobId },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
      error: true,
      updatedAt: true,
    },
  });
  return { ...draft, asyncJob };
}

export async function updateTaskBuildDraft(
  draftId: string,
  input: Partial<TaskBuildDraftInput>,
) {
  const existing = await prisma.taskBuildDraft.findUnique({
    where: { id: draftId },
    select: { id: true, courseId: true, chapterId: true, sectionId: true },
  });
  if (!existing) throw new Error("TASK_BUILD_DRAFT_NOT_FOUND");

  const nextScope = {
    courseId: input.courseId ?? existing.courseId,
    chapterId:
      input.chapterId === undefined ? existing.chapterId : input.chapterId,
    sectionId:
      input.sectionId === undefined ? existing.sectionId : input.sectionId,
  };
  await assertDraftScope(nextScope);

  const data: Prisma.TaskBuildDraftUpdateInput = {};
  if (input.courseId !== undefined) data.course = { connect: { id: input.courseId } };
  if (input.chapterId !== undefined) {
    data.chapter = input.chapterId ? { connect: { id: input.chapterId } } : { disconnect: true };
  }
  if (input.sectionId !== undefined) {
    data.section = input.sectionId ? { connect: { id: input.sectionId } } : { disconnect: true };
  }
  if (input.slot !== undefined) data.slot = input.slot ?? null;
  if (input.taskType !== undefined) data.taskType = input.taskType;
  if (input.title !== undefined) data.title = normalizeTitle(input.title);
  if (input.description !== undefined) {
    data.description = normalizeOptionalText(input.description);
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.progress !== undefined) data.progress = clampProgress(input.progress);
  if (input.sourceIds !== undefined) data.sourceIds = input.sourceIds;
  if (input.asyncJobId !== undefined) data.asyncJobId = input.asyncJobId || null;
  if (input.missingFields !== undefined) data.missingFields = input.missingFields;
  if (input.draftPayload !== undefined) {
    data.draftPayload = input.draftPayload ?? Prisma.JsonNull;
  }
  if (input.error !== undefined) data.error = normalizeOptionalText(input.error);

  return prisma.taskBuildDraft.update({
    where: { id: draftId },
    data,
  });
}

export async function deleteTaskBuildDraft(draftId: string) {
  const existing = await prisma.taskBuildDraft.findUnique({
    where: { id: draftId },
    select: { id: true },
  });
  if (!existing) throw new Error("TASK_BUILD_DRAFT_NOT_FOUND");
  return prisma.taskBuildDraft.delete({ where: { id: draftId } });
}

async function assertDraftScope(input: Pick<TaskBuildDraftInput, "courseId" | "chapterId" | "sectionId">) {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true },
  });
  if (!course) throw new Error("COURSE_NOT_FOUND");

  if (input.chapterId) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: input.chapterId },
      select: { id: true, courseId: true },
    });
    if (!chapter) throw new Error("CHAPTER_NOT_FOUND");
    if (chapter.courseId !== input.courseId) throw new Error("CHAPTER_COURSE_MISMATCH");
  }

  if (input.sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: input.sectionId },
      select: { id: true, courseId: true, chapterId: true },
    });
    if (!section) throw new Error("SECTION_NOT_FOUND");
    if (section.courseId !== input.courseId) throw new Error("SECTION_PARENT_MISMATCH");
    if (input.chapterId && section.chapterId !== input.chapterId) {
      throw new Error("SECTION_PARENT_MISMATCH");
    }
  }
}

function normalizeTitle(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || "未命名任务草稿";
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function clampProgress(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
