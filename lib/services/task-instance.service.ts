import { prisma } from "@/lib/db/prisma";
import { teacherCourseFilter } from "@/lib/services/course.service";
import { logAuditEvent } from "@/lib/services/audit.service";
import { clampTake } from "@/lib/pagination";
import { createTaskInTransaction } from "@/lib/services/task.service";
import type {
  CreatePublishedTaskWithInstanceInput,
  CreateTaskInstanceInput,
  UpdateTaskInstanceInput,
  UpdateTaskInstanceSnapshotInput,
} from "@/lib/validators/task.schema";
import type { Prisma } from "@prisma/client";

const taskSnapshotInclude = {
  simulationConfig: true,
  quizConfig: true,
  subjectiveConfig: true,
  scoringCriteria: { orderBy: { order: "asc" } },
  allocationSections: {
    orderBy: { order: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  },
  quizQuestions: { orderBy: { order: "asc" } },
} satisfies Prisma.TaskInclude;

type PublishableTaskConfig = {
  taskType: string;
  simulationConfig?: unknown | null;
  quizConfig?: unknown | null;
  subjectiveConfig?: { prompt?: string | null } | null;
  quizQuestions?: unknown[] | null;
};

export function assertTaskReadyForPublish(task: PublishableTaskConfig) {
  if (task.taskType === "simulation" && !task.simulationConfig) {
    throw new Error("TASK_CONFIG_INCOMPLETE");
  }

  if (task.taskType === "quiz") {
    if (!task.quizConfig || !Array.isArray(task.quizQuestions) || task.quizQuestions.length === 0) {
      throw new Error("TASK_CONFIG_INCOMPLETE");
    }
  }

  if (task.taskType === "subjective") {
    if (!task.subjectiveConfig?.prompt?.trim()) {
      throw new Error("TASK_CONFIG_INCOMPLETE");
    }
  }
}

async function isAuthorizedForInstance(instance: { createdBy: string; courseId: string | null }, userId: string): Promise<boolean> {
  if (instance.createdBy === userId) return true;
  if (!instance.courseId) return false;
  const collab = await prisma.courseTeacher.findUnique({
    where: { courseId_teacherId: { courseId: instance.courseId, teacherId: userId } },
  });
  return !!collab;
}

// Slice 1 (B1): patch 中某 key=null 表示"清空"，service 显式删除该 key。
// 在浅 merge 之后跑一遍，把 null 值的键从 merged 里 delete。
function applyClearSemantics(
  merged: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
): void {
  if (!patch) return;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete merged[k];
  }
}

export async function createTaskInstance(createdBy: string, input: CreateTaskInstanceInput) {
  return prisma.taskInstance.create({
    data: {
      title: input.title,
      description: input.description,
      taskId: input.taskId,
      taskType: input.taskType,
      classId: input.classId,
      groupIds: input.groupIds,
      courseId: input.courseId,
      chapterId: input.chapterId,
      sectionId: input.sectionId,
      slot: input.slot as "pre" | "in" | "post" | undefined,
      dueAt: new Date(input.dueAt),
      publishAt: input.publishAt ? new Date(input.publishAt) : undefined,
      attemptsAllowed: input.attemptsAllowed,
      createdBy,
    },
  });
}

/**
 * Codex-P1-r4: tx-aware 版本 — 让外部 caller 在已开启的 transaction 内复用，
 * 避免嵌套 $transaction（with-task route 把 draft reserve + create 包同一 tx）。
 */
export async function createPublishedTaskWithInstanceInTransaction(
  tx: Prisma.TransactionClient,
  createdBy: string,
  input: CreatePublishedTaskWithInstanceInput,
) {
  const task = await createTaskInTransaction(tx, createdBy, input.task);
  const taskForSnapshot = await tx.task.findUnique({
    where: { id: task.id },
    include: taskSnapshotInclude,
  });
  if (!taskForSnapshot) throw new Error("TASK_NOT_FOUND");
  assertTaskReadyForPublish(taskForSnapshot);

  const taskSnapshot = JSON.parse(JSON.stringify(taskForSnapshot)) as Prisma.InputJsonValue;
  const instance = await tx.taskInstance.create({
    data: {
      title: input.instance.title,
      description: input.instance.description,
      taskId: task.id,
      taskType: input.task.taskType,
      classId: input.instance.classId,
      groupIds: input.instance.groupIds,
      courseId: input.instance.courseId,
      chapterId: input.instance.chapterId,
      sectionId: input.instance.sectionId,
      slot: input.instance.slot as "pre" | "in" | "post" | undefined,
      dueAt: new Date(input.instance.dueAt),
      publishAt: input.instance.publishAt
        ? new Date(input.instance.publishAt)
        : undefined,
      attemptsAllowed: input.instance.attemptsAllowed,
      status: "published",
      publishedAt: new Date(),
      taskSnapshot,
      createdBy,
    },
  });

  return { task: taskForSnapshot, instance };
}

export async function createPublishedTaskWithInstance(
  createdBy: string,
  input: CreatePublishedTaskWithInstanceInput,
) {
  const output = await prisma.$transaction(async (tx) =>
    createPublishedTaskWithInstanceInTransaction(tx, createdBy, input),
  );

  // Phase3-A · Root cause 1: 任务发布后若是 adaptive quiz，自动 enqueue tagger job
  // （createTask 已有同款；本路径 createPublishedTaskWithInstance 之前漏触发，学生进 adaptive
  //  task 时 < 50% tagged → fallback "知识点诊断暂未启用"，演示卡死）
  if (
    input.task.taskType === "quiz" &&
    input.task.quizConfig?.mode === "adaptive" &&
    (input.task.quizQuestions?.length ?? 0) > 0
  ) {
    try {
      const { enqueueAsyncJob } = await import("./async-job.service");
      await enqueueAsyncJob({
        type: "quiz_question_tag",
        entityType: "task",
        entityId: output.task.id,
        input: { taskId: output.task.id },
        createdBy,
      });
    } catch (err) {
      console.error(
        "[createPublishedTaskWithInstance] 自动触发 quiz_question_tag 失败（不阻塞）：",
        err,
      );
    }
  }

  return output;
}

export async function publishTaskInstance(instanceId: string, createdBy: string) {
  const instance = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    include: {
      task: {
        include: taskSnapshotInclude,
      },
    },
  });

  if (!instance || !(await isAuthorizedForInstance(instance, createdBy))) {
    throw new Error("FORBIDDEN");
  }
  if (instance.status !== "draft") {
    throw new Error("INVALID_STATUS");
  }
  assertTaskReadyForPublish(instance.task);

  // 冻结任务快照
  const taskSnapshot = JSON.parse(JSON.stringify(instance.task));

  return prisma.taskInstance.update({
    where: { id: instanceId },
    data: {
      status: "published",
      publishedAt: new Date(),
      taskSnapshot,
    },
  });
}

export async function getTaskInstances(filters: {
  courseId?: string;
  classId?: string;
  status?: string;
  createdBy?: string;
  take?: number;
}) {
  return prisma.taskInstance.findMany({
    where: {
      ...(filters.courseId && { courseId: filters.courseId }),
      ...(filters.classId && { classId: filters.classId }),
      ...(filters.status && { status: filters.status as "draft" | "published" | "closed" | "archived" }),
      ...(filters.createdBy && {
        OR: [
          { createdBy: filters.createdBy },
          { course: teacherCourseFilter(filters.createdBy) },
        ],
      }),
    },
    include: {
      task: { select: { id: true, taskName: true, taskType: true } },
      class: { select: { id: true, name: true } },
      course: { select: { id: true, courseTitle: true } },
      chapter: { select: { id: true, title: true, order: true } },
      section: { select: { id: true, title: true, order: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(filters.take, 100, 200),
  });
}

export async function getTaskInstanceById(instanceId: string) {
  return prisma.taskInstance.findUnique({
    where: { id: instanceId },
    include: {
      task: {
        include: {
          simulationConfig: true,
          quizConfig: true,
          subjectiveConfig: true,
          scoringCriteria: { orderBy: { order: "asc" } },
          allocationSections: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
          quizQuestions: { orderBy: { order: "asc" } },
        },
      },
      class: true,
      course: { select: { id: true, courseTitle: true } },
      chapter: { select: { id: true, title: true } },
      section: { select: { id: true, title: true } },
      _count: { select: { submissions: true } },
    },
  });
}

export async function updateTaskInstance(
  instanceId: string,
  createdBy: string,
  input: UpdateTaskInstanceInput
) {
  const existing = await prisma.taskInstance.findUnique({ where: { id: instanceId } });
  if (!existing || !(await isAuthorizedForInstance(existing, createdBy))) {
    throw new Error("FORBIDDEN");
  }

  const updated = await prisma.taskInstance.update({
    where: { id: instanceId },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.dueAt && { dueAt: new Date(input.dueAt) }),
      ...(input.publishAt && { publishAt: new Date(input.publishAt) }),
      ...(input.attemptsAllowed !== undefined && { attemptsAllowed: input.attemptsAllowed }),
      ...(input.groupIds && { groupIds: input.groupIds }),
      ...(input.status && { status: input.status }),
    },
  });

  // PR-1 D: 教师改 instance（title / dueAt / status 等）需 audit — PR #13 path 之前漏掉
  await logAuditEvent({
    action: "task_instance.update",
    actorRole: existing.createdBy === createdBy ? "owner" : "collaborator",
    actorId: createdBy,
    targetId: instanceId,
    targetType: "TaskInstance",
    metadata: { changedFields: Object.keys(input), title: existing.title },
  });

  return updated;
}

export async function deleteTaskInstance(instanceId: string, createdBy: string) {
  const existing = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true, createdBy: true, courseId: true, title: true },
  });
  if (!existing || !(await isAuthorizedForInstance(existing, createdBy))) {
    throw new Error("FORBIDDEN");
  }
  if (existing.status !== "draft" && existing.status !== "closed") {
    throw new Error("TASK_INSTANCE_NOT_DELETABLE");
  }
  const submissionCount = await prisma.submission.count({
    where: { taskInstanceId: instanceId },
  });
  if (submissionCount > 0) {
    throw new Error("INSTANCE_HAS_SUBMISSIONS");
  }
  const deleted = await prisma.taskInstance.delete({ where: { id: instanceId } });
  await logAuditEvent({
    action: "task_instance.delete",
    actorRole: existing.createdBy === createdBy ? "owner" : "collaborator",
    actorId: createdBy,
    targetId: instanceId,
    targetType: "TaskInstance",
    metadata: { title: existing.title, previousStatus: existing.status },
  });
  return deleted;
}

/**
 * Reopen a closed task instance. Status closed -> published. 写 audit。
 * 用于"误关后挽回"场景，是任务实例状态机第三态。
 */
export async function reopenTaskInstance(instanceId: string, actorId: string) {
  const existing = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true, createdBy: true, courseId: true, title: true },
  });
  if (!existing || !(await isAuthorizedForInstance(existing, actorId))) {
    throw new Error("FORBIDDEN");
  }
  if (existing.status !== "closed") {
    throw new Error("TASK_INSTANCE_NOT_REOPENABLE");
  }
  const updated = await prisma.taskInstance.update({
    where: { id: instanceId },
    data: { status: "published" },
  });
  await logAuditEvent({
    action: "task_instance.reopen",
    actorRole: existing.createdBy === actorId ? "owner" : "collaborator",
    actorId,
    targetId: instanceId,
    targetType: "TaskInstance",
    metadata: { title: existing.title, previousStatus: "closed" },
  });
  return updated;
}

/**
 * Close a published task instance. Status published -> closed. 写 audit。
 * 关闭后学生 assertTaskInstanceReadable 会拒绝读取（403），已提交的 submission 仍可通过 /grades 查看。
 */
export async function closeTaskInstance(instanceId: string, actorId: string) {
  const existing = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true, createdBy: true, courseId: true, title: true },
  });
  if (!existing || !(await isAuthorizedForInstance(existing, actorId))) {
    throw new Error("FORBIDDEN");
  }
  if (existing.status !== "published") {
    throw new Error("TASK_INSTANCE_NOT_CLOSEABLE");
  }
  const updated = await prisma.taskInstance.update({
    where: { id: instanceId },
    data: { status: "closed" },
  });
  await logAuditEvent({
    action: "task_instance.close",
    actorRole: existing.createdBy === actorId ? "owner" : "collaborator",
    actorId,
    targetId: instanceId,
    targetType: "TaskInstance",
    metadata: { title: existing.title, previousStatus: "published" },
  });
  return updated;
}

// Unit A1: 教师在 overview 改 instance 的 taskSnapshot（学生看到的配置）。
// - auth: 仅 createdBy 或课程协作教师
// - 校验 patch.taskType 必须等于 instance.taskType（防止跨类型篡改）
// - taskSnapshot 是 Json 字段，deep-merge 顶层键；不允许覆盖 id / taskType / taskName
// - Slice 1 (B1): 嵌套 config 内 key=null 表示"清空"（service delete from merged）
// - 返回 { instance, gradedCount }：UI 根据 graded 数显示警告
export async function updateTaskInstanceSnapshot(
  instanceId: string,
  createdBy: string,
  patch: UpdateTaskInstanceSnapshotInput,
) {
  const existing = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      createdBy: true,
      courseId: true,
      taskType: true,
      taskSnapshot: true,
    },
  });
  if (!existing) throw new Error("INSTANCE_NOT_FOUND");
  if (!(await isAuthorizedForInstance(existing, createdBy))) {
    throw new Error("FORBIDDEN");
  }
  if (existing.taskType !== patch.taskType) {
    throw new Error("TASK_TYPE_MISMATCH");
  }

  // Deep-merge patch 顶层键到现有 snapshot，守 id / taskType / taskName 不变
  const currentSnapshot = (existing.taskSnapshot ?? {}) as Record<string, unknown>;
  const mergedSnapshot: Record<string, unknown> = { ...currentSnapshot };

  if (patch.taskType === "simulation") {
    if (patch.simulationConfig !== undefined) {
      const currentSim = (currentSnapshot.simulationConfig ?? {}) as Record<string, unknown>;
      const nextSim: Record<string, unknown> = { ...currentSim, ...patch.simulationConfig };
      applyClearSemantics(nextSim, patch.simulationConfig as Record<string, unknown>);
      mergedSnapshot.simulationConfig = nextSim;
    }
    if (patch.scoringCriteria !== undefined) {
      mergedSnapshot.scoringCriteria = patch.scoringCriteria;
    }
    if (patch.allocationSections !== undefined) {
      mergedSnapshot.allocationSections = patch.allocationSections;
    }
  } else if (patch.taskType === "quiz") {
    if (patch.quizConfig !== undefined) {
      const currentQuiz = (currentSnapshot.quizConfig ?? {}) as Record<string, unknown>;
      const nextQuiz: Record<string, unknown> = { ...currentQuiz, ...patch.quizConfig };
      applyClearSemantics(nextQuiz, patch.quizConfig as Record<string, unknown>);
      mergedSnapshot.quizConfig = nextQuiz;
    }
    if (patch.quizQuestions !== undefined) {
      mergedSnapshot.quizQuestions = patch.quizQuestions;
    }
    if (patch.scoringCriteria !== undefined) {
      mergedSnapshot.scoringCriteria = patch.scoringCriteria;
    }
  } else if (patch.taskType === "subjective") {
    if (patch.subjectiveConfig !== undefined) {
      const currentSub = (currentSnapshot.subjectiveConfig ?? {}) as Record<string, unknown>;
      const nextSub: Record<string, unknown> = { ...currentSub, ...patch.subjectiveConfig };
      applyClearSemantics(nextSub, patch.subjectiveConfig as Record<string, unknown>);
      mergedSnapshot.subjectiveConfig = nextSub;
    }
    if (patch.scoringCriteria !== undefined) {
      mergedSnapshot.scoringCriteria = patch.scoringCriteria;
    }
  }

  // 守不变字段：强制保留原 id / taskType / taskName（即便 currentSnapshot 里有）
  if (currentSnapshot.id !== undefined) mergedSnapshot.id = currentSnapshot.id;
  if (currentSnapshot.taskType !== undefined) mergedSnapshot.taskType = currentSnapshot.taskType;
  if (currentSnapshot.taskName !== undefined) mergedSnapshot.taskName = currentSnapshot.taskName;

  const [updated, gradedCount] = await prisma.$transaction([
    prisma.taskInstance.update({
      where: { id: instanceId },
      data: { taskSnapshot: mergedSnapshot as Prisma.InputJsonValue },
    }),
    prisma.submission.count({
      where: { taskInstanceId: instanceId, status: "graded" },
    }),
  ]);

  // PR-1 D: 教师改 instance taskSnapshot（学生看到的题面/配置）— PR #13 path 之前漏掉
  // 含 gradedCount > 0 时标 force=true（review-pr13 F-7 提到的"我知道，仍然保存"高危场景）
  await logAuditEvent({
    action: "task_instance.snapshot_update",
    actorRole: existing.createdBy === createdBy ? "owner" : "collaborator",
    actorId: createdBy,
    targetId: instanceId,
    targetType: "TaskInstance",
    metadata: {
      taskType: patch.taskType,
      gradedCount,
      ...(gradedCount > 0 && { force: true }),
    },
  });

  return { instance: updated, gradedCount };
}
