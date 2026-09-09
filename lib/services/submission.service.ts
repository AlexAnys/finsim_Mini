import { invalidateSubmissionInsights } from "./insight-invalidation";
import { buildAdaptiveState, buildMasteryReport } from "./quiz-adaptive.service";
import { gradingTaskInclude, resolveGradingTask, freezeTask } from "./task-version";
import { scheduleAsyncJob } from "./async-job.service";
import { getCurrentJobLease } from "./async-job-context";
import { studentTaskView } from "@/lib/utils/student-task-view";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { CreateSubmissionInput } from "@/lib/validators/submission.schema";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import { logAuditEvent } from "@/lib/services/audit.service";
import { clampPage, clampTake } from "@/lib/pagination";

type UserLike = { id: string; role: string; classId?: string | null };

// PR-SIM-1a D1: 防作弊·学生可见数据剥离辅助
//
// "已分析未公布"语义：grading 完成（status=graded）但教师/cron 还没设 releasedAt → 学生看到的对象需剥离
// score / maxScore / evaluation / feedback / rubricBreakdown / conceptTags / scoreDist 等敏感字段。
//
// 派生 analysisStatus：
// - status=submitted/grading && releasedAt=null  → "pending"
// - status=graded && releasedAt=null             → "analyzed_unreleased"
// - status=graded && releasedAt!=null            → "released"
// - status=failed                                → "pending"（视为待重试，UI 处理）
export type SubmissionAnalysisStatus = "pending" | "analyzed_unreleased" | "released";

export function deriveAnalysisStatus(args: {
  status: string;
  releasedAt: Date | null | undefined;
}): SubmissionAnalysisStatus {
  if (args.status === "graded" && args.releasedAt) return "released";
  if (args.status === "graded") return "analyzed_unreleased";
  return "pending";
}

/**
 * 把含 evaluation / score 的 submission 对象剥离敏感字段，得到学生可见版本。
 * 输入对象保持不可变（返回新对象）。
 *
 * 剥离规则：
 * - 顶层 score / maxScore → null
 * - simulationSubmission / quizSubmission / subjectiveSubmission 的 evaluation / conceptTags → null/[]
 * - 不动 transcript / answers / textAnswer / attachments（学生自己提交的内容仍可见）
 * - 总是附 analysisStatus 字段
 *
 * Fix 6 例外：当 status="failed" 时保留 evaluation.feedback 字段（仅 feedback 一个字段），
 * 让学生在 grades 页看到「AI 批改暂未完成…」的中文提示。其余敏感字段照常剥离。
 *
 * 注：当 releasedAt 非 null 时，此函数仍返回原始数据（仅加 analysisStatus="released"），不剥离。
 */
export function stripSubmissionForStudent<T extends Record<string, unknown>>(submission: T): T & { analysisStatus: SubmissionAnalysisStatus } {
  const status = String((submission as { status?: unknown }).status ?? "");
  const releasedAt = (submission as { releasedAt?: Date | string | null }).releasedAt ?? null;
  const analysisStatus = deriveAnalysisStatus({
    status,
    releasedAt: releasedAt ? new Date(releasedAt) : null,
  });

  if (analysisStatus === "released") {
    return { ...studentTaskView(submission), analysisStatus } as T & { analysisStatus: SubmissionAnalysisStatus };
  }

  // pending / analyzed_unreleased: 剥离敏感字段
  const stripped: Record<string, unknown> = { ...studentTaskView(submission) };
  stripped.score = null;
  stripped.maxScore = null;

  // Fix 6: status="failed" 时保留 evaluation.feedback（学生需要看到中文失败提示），
  // 但仍剥离 score 与 rubricBreakdown / conceptTags（避免泄露评分结构）。
  const isFailed = status === "failed";

  for (const sub of ["simulationSubmission", "quizSubmission", "subjectiveSubmission"] as const) {
    const detail = stripped[sub] as Record<string, unknown> | null | undefined;
    if (detail && typeof detail === "object") {
      let preservedEvaluation: Record<string, unknown> | null = null;
      if (isFailed) {
        const ev = detail.evaluation as Record<string, unknown> | null | undefined;
        const feedback = ev && typeof ev === "object" ? ev.feedback : undefined;
        if (typeof feedback === "string" && feedback.length > 0) {
          preservedEvaluation = { feedback };
        }
      }
      stripped[sub] = {
        ...detail,
        evaluation: preservedEvaluation,
        conceptTags: [],
      };
    }
  }

  return { ...stripped, analysisStatus } as T & { analysisStatus: SubmissionAnalysisStatus };
}

export async function createSubmission(studentId: string, input: CreateSubmissionInput) {
  if (!input.taskInstanceId) throw new Error("TASK_INSTANCE_REQUIRED");
  const result = await prisma.$transaction(async (tx) => {
    // Serialize attempts, version changes and retries for this assignment.
    await tx.$queryRaw`SELECT id FROM "TaskInstance" WHERE id = ${input.taskInstanceId} FOR UPDATE`;
    const instance = await tx.taskInstance.findUnique({
      where: { id: input.taskInstanceId },
      include: { task: { include: gradingTaskInclude }, course: { select: { deletedAt: true } } },
    });
    if (!instance) throw new Error("TASK_INSTANCE_NOT_FOUND");
    const student = await tx.user.findUnique({ where: { id: studentId }, select: { classId: true, role: true } });
    if (student?.role !== "student" || student.classId !== instance.classId) throw new Error("FORBIDDEN");
    if (input.requestId) {
      const previous = await tx.submission.findUnique({ where: { studentId_requestId: { studentId, requestId: input.requestId } } });
      if (previous) {
        if (previous.taskInstanceId !== instance.id || previous.deletedAt) throw new Error("SUBMISSION_REQUEST_CONFLICT");
        const gradingJob = await tx.asyncJob.findFirst({ where: { type: "submission_grade", entityId: previous.id }, orderBy: { createdAt: "desc" } });
        return { ...previous, gradingJob };
      }
    }
    if (instance.status !== "published") throw new Error("TASK_NOT_PUBLISHED");
    if (instance.course?.deletedAt) throw new Error("COURSE_ARCHIVED");
    if (!(input.taskType === "quiz" && input.attemptId) && input.taskVersion !== undefined && input.taskVersion !== instance.contentVersion) throw new Error("TASK_VERSION_CHANGED");
    if (instance.taskId !== input.taskId || instance.taskType !== input.taskType) throw new Error("FORBIDDEN");
    if (instance.attemptsAllowed) {
      const count = await tx.submission.count({ where: { studentId, taskInstanceId: instance.id, deletedAt: null } });
      if (count >= instance.attemptsAllowed) throw new Error("MAX_ATTEMPTS_REACHED");
    }
    let task = resolveGradingTask(instance.taskSnapshot, instance.task);
    let quizAnswers = input.taskType === "quiz" ? input.answers : [];
    let quizAttemptId: string | undefined;
    let masteryReport: Prisma.InputJsonValue | undefined;
    if (input.taskType === "quiz" && (input.attemptId || task.quizConfig?.mode === "adaptive")) {
      if (!input.attemptId) throw new Error("QUIZ_ATTEMPT_REQUIRED");
      const attempt = await tx.quizAttempt.findUnique({ where: { id: input.attemptId }, include: { submission: true } });
      if (!attempt || attempt.studentId !== studentId || attempt.taskInstanceId !== instance.id) throw new Error("FORBIDDEN");
      if (attempt.submission) {
        const gradingJob = await tx.asyncJob.findFirst({ where: { type: "submission_grade", entityId: attempt.submission.id }, orderBy: { createdAt: "desc" } });
        return { ...attempt.submission, gradingJob };
      }
      if (!attempt.completedAt) throw new Error("QUIZ_ATTEMPT_INCOMPLETE");
      task = resolveGradingTask(attempt.taskSnapshot, task);
      const checkedHistory = attempt.answers as unknown as Array<{ questionId: string; correct: boolean }>;
      const adaptiveConfig = { maxQuestions: task.quizConfig?.maxQuestions ?? 8, startDifficulty: task.quizConfig?.startDifficulty ?? 5, difficultyStep: task.quizConfig?.difficultyStep ?? 1 };
      masteryReport = buildMasteryReport(buildAdaptiveState(checkedHistory, task.quizQuestions, adaptiveConfig), checkedHistory) as unknown as Prisma.InputJsonValue;
      // Only issued, server-recorded answers can contribute to this sitting.
      task = { ...task, quizQuestions: task.quizQuestions.filter(q => attempt.issuedQuestionIds.includes(q.id)) };
      quizAnswers = (attempt.answers as unknown as typeof quizAnswers);
      quizAttemptId = attempt.id;
    }
    if (input.taskType === "quiz") {
      const ids = new Set(task.quizQuestions.map(q => q.id));
      if (quizAnswers.some(a => !ids.has(a.questionId)) || new Set(quizAnswers.map(a => a.questionId)).size !== quizAnswers.length) throw new Error("QUIZ_ANSWERS_INVALID");
    }
    const uploads = [];
    if (input.taskType === "subjective") {
      for (const attachment of input.attachments ?? []) {
        const upload = attachment.uploadId
          ? await tx.fileUpload.findUnique({ where: { id: attachment.uploadId } })
          : await tx.fileUpload.findUnique({ where: { filePath: attachment.filePath } });
        if (!upload || upload.ownerId !== studentId) throw new Error("ATTACHMENT_FORBIDDEN");
        const allowed = task.subjectiveConfig?.allowedAttachmentTypes ?? [];
        const ext = upload.fileName.split(".").pop()?.toLowerCase();
        if (!ext || !allowed.map(t => t.replace(/^\./, "").toLowerCase()).includes(ext)) throw new Error("ATTACHMENT_TYPE_NOT_ALLOWED");
        uploads.push(upload);
      }
      if (!input.textAnswer?.trim() && uploads.length === 0) throw new Error("SUBMISSION_CONTENT_REQUIRED");
    }
    const submission = await tx.submission.create({ data: {
      studentId, taskId: input.taskId, taskType: input.taskType, taskInstanceId: instance.id,
      requestId: input.requestId, quizAttemptId, taskSnapshot: freezeTask(task), status: "submitted",
    } });
    if (input.taskType === "simulation") {
      await tx.simulationSubmission.create({ data: { submissionId: submission.id, transcript: input.transcript, assets: input.assets ?? undefined } });
    } else if (input.taskType === "quiz") {
      await tx.quizSubmission.create({ data: { submissionId: submission.id, answers: quizAnswers,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        finishedAt: input.finishedAt ? new Date(input.finishedAt) : undefined, durationSeconds: input.durationSeconds, evaluation: masteryReport ? { adaptiveMasteryReport: masteryReport } : undefined } });
    } else {
      await tx.subjectiveSubmission.create({ data: { submissionId: submission.id, textAnswer: input.textAnswer,
        attachments: { create: uploads.map(u => ({ fileName: u.fileName, filePath: u.filePath, fileSize: u.fileSize, contentType: u.contentType })) } } });
    }
    const gradingJob = await tx.asyncJob.create({ data: { type: "submission_grade", entityType: "Submission", entityId: submission.id,
      input: { submissionId: submission.id }, createdBy: studentId } });
    return { ...submission, gradingJob };
  }, { timeout: 15000, maxWait: 10000 });
  if (result.gradingJob?.status === "queued") scheduleAsyncJob(result.gradingJob.id);
  return result;
}

export async function getSubmissions(filters: {
  taskInstanceId?: string;
  studentId?: string;
  taskId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  actor?: UserLike;
  includeDeleted?: boolean;
}) {
  const page = clampPage(filters.page);
  const pageSize = clampTake(filters.pageSize, 20, 100);
  const skip = (page - 1) * pageSize;

  const actorScope: Prisma.SubmissionWhereInput = filters.actor?.role === "teacher" ? { OR: [
    { task: { creatorId: filters.actor.id } },
    { taskInstance: { createdBy: filters.actor.id } },
    { taskInstance: { course: { OR: [{ createdBy: filters.actor.id }, { teachers: { some: { teacherId: filters.actor.id } } }] } } },
  ] } : {};
  const where: Prisma.SubmissionWhereInput = {
    AND: [actorScope],
    deletedAt: filters.includeDeleted ? { not: null } : null,
    ...(filters.taskInstanceId && { taskInstanceId: filters.taskInstanceId }),
    ...(filters.studentId && { studentId: filters.studentId }),
    ...(filters.taskId && { taskId: filters.taskId }),
    ...(filters.status && { status: filters.status as "submitted" | "grading" | "graded" | "failed" }),
    // U3-F2：已归档课程的提交从列表消失（兑现 D2：学生 /grades 不见已归档课程成绩）。
    // 保留 taskInstanceId=null 的独立提交可见。按显式 taskInstanceId 查询时不加此闸 ——
    // 该路径已有实例访问守卫，且 owner/教师需访问特定实例提交（Bucket 4/5）。
    ...(!filters.taskInstanceId && {
      OR: [
        { taskInstanceId: null },
        { taskInstance: { courseId: null } },
        { taskInstance: { course: { deletedAt: null } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, email: true } },
        task: {
          select: {
            id: true,
            taskName: true,
            taskType: true,
            // PR-15 bug 6a: 学生 /grades 评估面板用 criterion.name 显示维度名，
            // 而非 evaluation.rubricBreakdown[].criterionId (CUID); 排序与 grading.service 一致
            scoringCriteria: {
              select: { id: true, name: true, maxPoints: true, order: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        simulationSubmission: true,
        quizSubmission: true,
        subjectiveSubmission: { include: { attachments: true } },
      },
      orderBy: { submittedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.submission.count({ where }),
  ]);

  return {
    items: items.map(item => ({ ...item, task: resolveGradingTask(item.taskSnapshot, item.task) })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getSubmissionById(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: { select: { id: true, name: true, email: true } },
      task: {
        include: {
          scoringCriteria: { orderBy: { order: "asc" } },
          simulationConfig: true,
          quizConfig: true,
          subjectiveConfig: true,
        },
      },
      simulationSubmission: true,
      quizSubmission: true,
      subjectiveSubmission: { include: { attachments: true } },
    },
  });
  return submission ? { ...submission, task: resolveGradingTask(submission.taskSnapshot, submission.task) } : null;
}

export async function updateSubmissionGrade(
  submissionId: string,
  data: {
    status: "grading" | "graded" | "failed";
    score?: number;
    maxScore?: number;
    evaluation?: Record<string, unknown>;
    conceptTags?: string[];
    /**
     * PR-SIM-1a D1: 由调用方（grading.service / 教师手动批改）显式传入。
     * - 显式 Date：写入对应时刻（auto 模式 immediate release / 教师手工公布）
     * - null：显式撤回（unrelease）
     * - undefined：保持现有 releasedAt 值不变（grading 中间态、grading.service 当前默认）
     */
    releasedAt?: Date | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const lease = getCurrentJobLease();
    if (lease) {
      const jobs = await tx.$queryRaw<Array<{ status: string; attempts: number }>>`SELECT status, attempts FROM "AsyncJob" WHERE id = ${lease.jobId} FOR UPDATE`;
      if (jobs[0]?.status !== "running" || jobs[0]?.attempts !== lease.attempt) throw new Error("ASYNC_JOB_LEASE_LOST");
    }
    await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${submissionId} FOR UPDATE`;
    const current = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!current || current.deletedAt) throw new Error("SUBMISSION_NOT_FOUND");
    if (lease && current.status === "graded") throw new Error("ASYNC_JOB_LEASE_LOST");
    const submission = await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: data.status,
        score: data.score,
        maxScore: data.maxScore,
        gradedAt: data.status === "graded" ? new Date() : undefined,
        ...(data.releasedAt !== undefined && { releasedAt: current.releaseSuppressedAt ? null : data.releasedAt }),
      },
    });

    // 更新类型专属记录的 evaluation + conceptTags
    const hasEval = data.evaluation !== undefined;
    const hasTags = data.conceptTags !== undefined;
    if (hasEval || hasTags) {
      const updateData: {
        evaluation?: import("@prisma/client").Prisma.InputJsonValue;
        conceptTags?: string[];
      } = {};
      if (hasEval) {
        updateData.evaluation = data.evaluation as unknown as import("@prisma/client").Prisma.InputJsonValue;
      }
      if (hasTags) {
        updateData.conceptTags = data.conceptTags ?? [];
      }
      if (submission.taskType === "simulation") {
        await tx.simulationSubmission.update({
          where: { submissionId },
          data: updateData,
        });
      } else if (submission.taskType === "quiz") {
        await tx.quizSubmission.update({
          where: { submissionId },
          data: updateData,
        });
      } else if (submission.taskType === "subjective") {
        await tx.subjectiveSubmission.update({
          where: { submissionId },
          data: updateData,
        });
      }
    }

    if (data.status !== "grading") await invalidateSubmissionInsights(tx, { taskId: submission.taskId, taskInstanceId: submission.taskInstanceId });
    return submission;
  });
}

export async function resetSubmissionForRetry(submissionId: string) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: "submitted",
        score: null,
        maxScore: null,
        gradedAt: null,
        releasedAt: null,
      },
    });

    if (submission.taskType === "simulation") {
      await tx.simulationSubmission.updateMany({
        where: { submissionId },
        data: { evaluation: Prisma.DbNull, conceptTags: [] },
      });
    } else if (submission.taskType === "quiz") {
      await tx.quizSubmission.updateMany({
        where: { submissionId },
        data: { evaluation: Prisma.DbNull, conceptTags: [] },
      });
    } else if (submission.taskType === "subjective") {
      await tx.subjectiveSubmission.updateMany({
        where: { submissionId },
        data: { evaluation: Prisma.DbNull, conceptTags: [] },
      });
    }

    return submission;
  });
}

/**
 * Unit 5b: 撤销批改（graded -> submitted）
 * - 仅 graded submission 可被撤销，否则 SUBMISSION_NOT_GRADED_YET
 * - 清 score / maxScore / gradedAt / releasedAt
 * - **保留** evaluation + conceptTags（与 resetSubmissionForRetry 不同 — 老师参考价值）
 * - audit log submission.ungrade
 */
export async function ungradeSubmission(submissionId: string, actorId: string) {
  const existing = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, taskId: true, taskInstanceId: true, studentId: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) throw new Error("SUBMISSION_NOT_FOUND");
  if (existing.status !== "graded") {
    throw new Error("SUBMISSION_NOT_GRADED_YET");
  }

  await prisma.$transaction(async tx => {
    await tx.asyncJob.updateMany({ where: { type: "submission_grade", entityId: submissionId, status: { in: ["queued", "running"] } }, data: { status: "canceled", completedAt: new Date() } });
    await tx.submission.update({ where: { id: submissionId, status: "graded", deletedAt: null }, data: { status: "submitted", score: null, maxScore: null, gradedAt: null, releasedAt: null, releaseSuppressedAt: new Date() } });
    await invalidateSubmissionInsights(tx, existing);
  });

  await logAuditEvent({
    action: "submission.ungrade",
    actorRole: "owner",
    actorId,
    targetId: submissionId,
    targetType: "Submission",
    metadata: {
      studentId: existing.studentId,
      taskInstanceId: existing.taskInstanceId,
      previousStatus: "graded",
    },
  });
}

export async function deleteSubmission(submissionId: string, user: UserLike) {
  await batchDeleteSubmissions([submissionId], user);
}

export async function batchDeleteSubmissions(ids: string[], user: UserLike | string) {
  const actor = typeof user === "string" ? { id: user, role: "teacher" } : user;
  const uniqueIds = [...new Set(ids)];
  for (const id of uniqueIds) await assertSubmissionReadable(id, actor);
  return prisma.$transaction(async tx => {
    const existing = await tx.submission.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, taskId: true, taskInstanceId: true, status: true, score: true, maxScore: true } });
    if (existing.length !== uniqueIds.length) throw new Error("SUBMISSION_NOT_FOUND");
    // Match worker lock order (job, then submission) to avoid a delete/grade deadlock.
    await tx.asyncJob.updateMany({ where: { type: "submission_grade", entityId: { in: uniqueIds }, status: { in: ["queued", "running"] } }, data: { status: "canceled", completedAt: new Date() } });
    const result = await tx.submission.updateMany({ where: { id: { in: uniqueIds }, deletedAt: null }, data: { deletedAt: new Date(), deletedBy: actor.id } });
    await tx.auditLog.create({ data: { action: "submission.delete", actorId: actor.id, targetType: "Submission", metadata: { actorRole: actor.role, submissions: existing.map(s => ({ ...s, score: s.score?.toString() ?? null, maxScore: s.maxScore?.toString() ?? null })) } } });
    for (const row of existing) await invalidateSubmissionInsights(tx, row);
    return result;
  });
}

export async function restoreSubmission(submissionId: string, user: UserLike) {
  await assertSubmissionReadable(submissionId, user);
  return prisma.$transaction(async tx => {
    const existing = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!existing) throw new Error("SUBMISSION_NOT_FOUND");
    const restored = await tx.submission.update({ where: { id: submissionId }, data: { deletedAt: null, deletedBy: null, ...(existing.status === "grading" || existing.status === "submitted" ? { status: "failed" } : {}) } });
    await tx.auditLog.create({ data: { action: "submission.restore", actorId: user.id, targetType: "Submission", targetId: submissionId, metadata: { actorRole: user.role } } });
    await invalidateSubmissionInsights(tx, restored);
    return restored;
  });
}


export async function retrySubmissionGrading(submissionId: string, user: UserLike) {
  await assertSubmissionReadable(submissionId, user);
  const job = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${submissionId} FOR UPDATE`;
    const submission = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!submission || submission.deletedAt) throw new Error("SUBMISSION_NOT_FOUND");
    if (submission.status === "graded") throw new Error("SUBMISSION_RETRY_NOT_ALLOWED");
    const active = await tx.asyncJob.findFirst({ where: { type: "submission_grade", entityId: submissionId, status: { in: ["queued", "running"] } } });
    if (active) return active;
    await tx.submission.update({ where: { id: submissionId }, data: { status: "submitted", score: null, maxScore: null, gradedAt: null, releasedAt: null } });
    return tx.asyncJob.create({ data: { type: "submission_grade", entityType: "Submission", entityId: submissionId, input: { submissionId, retriedBy: user.id }, createdBy: user.id } });
  });
  if (job.status === "queued") scheduleAsyncJob(job.id);
  return job;
}
