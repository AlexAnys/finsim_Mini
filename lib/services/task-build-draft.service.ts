import { Prisma, SlotType, TaskBuildDraftStatus, TaskType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/services/audit.service";

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
  aiPayload?: Prisma.InputJsonValue;
  editedPayload?: Prisma.InputJsonValue;
  error?: string | null;
}

export async function listTaskBuildDrafts(
  courseId: string,
  filters?: { status?: TaskBuildDraftStatus | TaskBuildDraftStatus[] },
) {
  const statusFilter = filters?.status;
  const drafts = await prisma.taskBuildDraft.findMany({
    where: {
      courseId,
      ...(statusFilter && {
        status: Array.isArray(statusFilter) ? { in: statusFilter } : statusFilter,
      }),
    },
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
      aiPayload: input.aiPayload ?? Prisma.JsonNull,
      editedPayload: input.editedPayload ?? Prisma.JsonNull,
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
  if (input.aiPayload !== undefined) {
    data.aiPayload = input.aiPayload ?? Prisma.JsonNull;
  }
  if (input.editedPayload !== undefined) {
    data.editedPayload = input.editedPayload ?? Prisma.JsonNull;
  }
  if (input.error !== undefined) data.error = normalizeOptionalText(input.error);

  return prisma.taskBuildDraft.update({
    where: { id: draftId },
    data,
  });
}

export async function approveTaskBuildDraft(draftId: string, actorId: string) {
  const draft = await prisma.taskBuildDraft.findUnique({
    where: { id: draftId },
    select: { id: true, status: true, courseId: true, title: true },
  });
  if (!draft) throw new Error("TASK_BUILD_DRAFT_NOT_FOUND");
  if (draft.status !== "ready") {
    throw new Error("TASK_BUILD_DRAFT_NOT_READY_FOR_APPROVAL");
  }

  const updated = await prisma.taskBuildDraft.update({
    where: { id: draftId },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: actorId,
    },
  });

  await logAuditEvent({
    action: "task_draft.approve",
    actorRole: "owner",
    actorId,
    targetId: draftId,
    targetType: "TaskBuildDraft",
    metadata: { courseId: draft.courseId, title: draft.title },
  });

  return updated;
}

/**
 * Codex-P1-r4: conditional atomic update — `where: { id, status: "approved" }`
 * 让 status 转换在 DB 层面 atomic。失败（draft 不存在 / 已被其他请求 flip）
 * 时 Prisma 抛 P2025；我们映射为 NOT_APPROVED_FOR_PUBLISH（统一文案，
 * race loser 也得到同一错误，不需要区分"不存在 vs 状态变了"）。
 *
 * 支持 optional tx 参数：with-task route 把 draft reserve + create 包同一
 * transaction，防止部分提交（额外 instance 持久化但 draft 状态没 flip）。
 *
 * 严格模式：只接受 status === "approved"。仅用于审核页 → 课程页发布的两阶段流程。
 */
export async function markTaskBuildDraftPublished(
  draftId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  try {
    return await client.taskBuildDraft.update({
      where: { id: draftId, status: "approved" },
      data: { status: "published" },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new Error("TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH");
    }
    throw err;
  }
}

/**
 * PR-15 bug 1 修法：放宽 publish 状态约束以支持 wizard 一步发布。
 *
 * 场景：用户从 inline section row 点开 draft / ready / approved 状态的草稿
 * → wizard 改完字段 → 点"创建并发布"。原 `markTaskBuildDraftPublished` 只接
 * status === "approved"，导致 ready/draft 经 wizard 发布后 draft 没 flip，
 * 仍残留在 inline 列表（filter 排除了 published 但没排除 ready/draft）。
 *
 * 接受集合：draft / ready / approved（不接受 queued / processing — 异步 job
 * 还在跑，状态机不允许跨阶段跳；不接受 failed — 失败的草稿应先 retry）。
 *
 * race guard 同 `markTaskBuildDraftPublished`：where 条件失败抛 P2025
 * → 映射为 TASK_BUILD_DRAFT_NOT_FOUND_OR_PUBLISHED（不区分"不存在 vs 已 publish"）。
 */
export async function markTaskBuildDraftPublishedFromWizard(
  draftId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  try {
    return await client.taskBuildDraft.update({
      where: { id: draftId, status: { in: ["draft", "ready", "approved"] } },
      data: { status: "published" },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new Error("TASK_BUILD_DRAFT_NOT_FOUND_OR_PUBLISHED");
    }
    throw err;
  }
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
