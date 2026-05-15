import { prisma } from "@/lib/db/prisma";
import type { AsyncJob, AsyncJobType, Prisma } from "@prisma/client";

type JsonInput = Prisma.InputJsonValue;

interface EnqueueAsyncJobInput {
  type: AsyncJobType;
  entityType?: string | null;
  entityId?: string | null;
  input?: JsonInput;
  createdBy: string;
  maxAttempts?: number;
  autoStart?: boolean;
}

const scheduledJobs = new Set<string>();

export async function enqueueAsyncJob(input: EnqueueAsyncJobInput) {
  const job = await prisma.asyncJob.create({
    data: {
      type: input.type,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      input: input.input ?? undefined,
      createdBy: input.createdBy,
      maxAttempts: input.maxAttempts ?? 3,
    },
  });

  if (input.autoStart !== false) scheduleAsyncJob(job.id);
  return job;
}

export function scheduleAsyncJob(jobId: string) {
  if (scheduledJobs.has(jobId)) return;
  scheduledJobs.add(jobId);
  setTimeout(() => {
    scheduledJobs.delete(jobId);
    runAsyncJob(jobId).catch((err) => {
      console.error("[async-job] failed outside job handler", err);
    });
  }, 0);
}

export async function getAsyncJob(jobId: string, user: { id: string; role: string }) {
  const job = await prisma.asyncJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("ASYNC_JOB_NOT_FOUND");
  if (user.role !== "admin" && job.createdBy !== user.id) throw new Error("FORBIDDEN");
  return job;
}

export async function retryAsyncJob(jobId: string, user: { id: string; role: string }) {
  const job = await getAsyncJob(jobId, user);
  if (job.status === "running" || job.status === "queued") throw new Error("ASYNC_JOB_IN_PROGRESS");
  if (job.attempts >= job.maxAttempts) throw new Error("ASYNC_JOB_MAX_ATTEMPTS");

  const updated = await prisma.asyncJob.update({
    where: { id: job.id },
    data: {
      status: "queued",
      progress: 0,
      error: null,
      result: undefined,
      startedAt: null,
      completedAt: null,
    },
  });
  scheduleAsyncJob(updated.id);
  return updated;
}

// Fix 10 · cron sweeper 阈值
// queued 超过 60s 还没被 in-process scheduler 接走（典型场景：Node 进程在 enqueue 后崩溃 / 重启），
// running 超过 10min 还没完成（典型场景：runAsyncJob 在 performAsyncJob 中卡死 / 进程崩溃）。
const SWEEP_QUEUED_STUCK_THRESHOLD_MS = 60_000;
const SWEEP_RUNNING_STUCK_THRESHOLD_MS = 10 * 60_000;
const SWEEP_BATCH_LIMIT = 50;

export interface SweepStuckJobsResult {
  scannedAt: string;
  queuedStuck: number;
  runningStuck: number;
  requeuedRunning: number;
  markedFailed: number;
  triggered: number;
  succeeded: number;
  failed: number;
}

/**
 * Fix 10 · cron sweeper 主入口（被 /api/cron/sweep-stuck-jobs 调用）。
 *
 * 行为：
 * 1) 找 status=queued 且 createdAt < now - 60s 的 job，直接调 runAsyncJob 触发。
 *    runAsyncJob 用 `updateMany where:{id, status:"queued"}` 原子认领，
 *    多个 cron 实例并发不会重复执行（claim count=0 即放弃）。
 * 2) 找 status=running 且 startedAt < now - 10min 的 job：
 *    - attempts < maxAttempts → 用 updateMany where status="running" 原子重置回 queued
 *      （avoid race：worker 正好写完 succeeded/failed 时，此处 count=0 跳过），
 *      然后调 runAsyncJob 重跑。
 *    - 已达 maxAttempts → 标 failed + error="STUCK_TIMEOUT_GAVE_UP"。
 *
 * 同一 cron 调用内 await Promise.allSettled，便于返回准确统计。
 * 单次最多扫 50 条 queued + 50 条 running，避免单次扫描爆库。
 */
export async function sweepStuckJobs(opts?: { now?: Date }): Promise<SweepStuckJobsResult> {
  const now = opts?.now ?? new Date();
  const queuedCutoff = new Date(now.getTime() - SWEEP_QUEUED_STUCK_THRESHOLD_MS);
  const runningCutoff = new Date(now.getTime() - SWEEP_RUNNING_STUCK_THRESHOLD_MS);

  const [stuckQueued, stuckRunning] = await Promise.all([
    prisma.asyncJob.findMany({
      where: { status: "queued", createdAt: { lt: queuedCutoff } },
      select: { id: true },
      take: SWEEP_BATCH_LIMIT,
      orderBy: { createdAt: "asc" },
    }),
    prisma.asyncJob.findMany({
      where: { status: "running", startedAt: { lt: runningCutoff } },
      select: { id: true, attempts: true, maxAttempts: true },
      take: SWEEP_BATCH_LIMIT,
      orderBy: { startedAt: "asc" },
    }),
  ]);

  let requeuedRunning = 0;
  let markedFailed = 0;
  const toTrigger: string[] = stuckQueued.map((j) => j.id);

  for (const job of stuckRunning) {
    if (job.attempts < job.maxAttempts) {
      // 原子重置：只在仍是 running 时改回 queued（避免覆盖正常完成的写）
      const upd = await prisma.asyncJob.updateMany({
        where: { id: job.id, status: "running" },
        data: {
          status: "queued",
          startedAt: null,
          progress: 0,
          error: "STUCK_TIMEOUT_RESET",
        },
      });
      if (upd.count > 0) {
        requeuedRunning++;
        toTrigger.push(job.id);
      }
    } else {
      const upd = await prisma.asyncJob.updateMany({
        where: { id: job.id, status: "running" },
        data: {
          status: "failed",
          error: "STUCK_TIMEOUT_GAVE_UP",
          completedAt: now,
        },
      });
      if (upd.count > 0) markedFailed++;
    }
  }

  // 触发执行 — runAsyncJob 内部的 updateMany 是原子 claim，多 cron 实例并发安全。
  // 并行 + allSettled，避免单 job 卡死阻塞整批。
  const results = await Promise.allSettled(toTrigger.map((id) => runAsyncJob(id)));
  let succeeded = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") succeeded++;
    else failed++;
  }

  return {
    scannedAt: now.toISOString(),
    queuedStuck: stuckQueued.length,
    runningStuck: stuckRunning.length,
    requeuedRunning,
    markedFailed,
    triggered: toTrigger.length,
    succeeded,
    failed,
  };
}

export async function runAsyncJob(jobId: string) {
  const claimed = await prisma.asyncJob.updateMany({
    where: { id: jobId, status: "queued" },
    data: {
      status: "running",
      progress: 5,
      attempts: { increment: 1 },
      startedAt: new Date(),
      completedAt: null,
      error: null,
    },
  });
  if (claimed.count === 0) {
    return prisma.asyncJob.findUnique({ where: { id: jobId } });
  }

  const job = await prisma.asyncJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("ASYNC_JOB_NOT_FOUND");

  try {
    const result = await performAsyncJob(job);
    return prisma.asyncJob.update({
      where: { id: jobId },
      data: {
        status: "succeeded",
        progress: 100,
        result: result ?? undefined,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    const message = errorMessage(err);
    return prisma.asyncJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: message,
        completedAt: new Date(),
      },
    });
  }
}

export async function updateAsyncJobProgress(jobId: string, progress: number) {
  return prisma.asyncJob.update({
    where: { id: jobId },
    data: { progress: Math.max(0, Math.min(99, Math.round(progress))) },
  });
}

async function performAsyncJob(job: AsyncJob): Promise<JsonInput | undefined> {
  switch (job.type) {
    case "knowledge_source_ingest": {
      const sourceId = readInputString(job, "sourceId") || job.entityId;
      if (!sourceId) throw new Error("KNOWLEDGE_SOURCE_NOT_FOUND");
      await updateAsyncJobProgress(job.id, 20);
      const { processCourseKnowledgeSource } = await import("@/lib/services/course-knowledge-source.service");
      const source = await processCourseKnowledgeSource(sourceId, job.createdBy);
      return {
        sourceId: source.id,
        status: source.status,
        textLength: source.extractedText?.length ?? 0,
      };
    }
    case "submission_grade": {
      const submissionId = readInputString(job, "submissionId") || job.entityId;
      if (!submissionId) throw new Error("SUBMISSION_NOT_FOUND");
      await updateAsyncJobProgress(job.id, 20);
      const { gradeSubmission } = await import("@/lib/services/grading.service");
      await gradeSubmission(submissionId);
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true, score: true, maxScore: true },
      });
      return {
        submissionId,
        status: submission?.status ?? "unknown",
        score: submission?.score?.toString() ?? null,
        maxScore: submission?.maxScore?.toString() ?? null,
      };
    }
    case "task_draft_generate":
      throw new Error("ASYNC_JOB_HANDLER_NOT_IMPLEMENTED");
    case "task_import_parse": {
      await updateAsyncJobProgress(job.id, 15);
      const { runQuestionBankProcessing } = await import("@/lib/services/question-bank.service");
      const draftId = readInputString(job, "draftId");
      try {
        return await runQuestionBankProcessing(job.input, job.createdBy, (progress) =>
          updateAsyncJobProgress(job.id, progress).then(() => undefined),
        );
      } catch (err) {
        if (draftId) {
          const { updateTaskBuildDraft } = await import("@/lib/services/task-build-draft.service");
          await updateTaskBuildDraft(draftId, {
            status: "failed",
            progress: 0,
            error: errorMessage(err),
          }).catch(() => undefined);
        }
        throw err;
      }
    }
    case "analytics_recompute": {
      const courseId = readInputString(job, "courseId") || job.entityId;
      if (!courseId) throw new Error("COURSE_NOT_FOUND");
      await updateAsyncJobProgress(job.id, 20);
      const { getAnalyticsV2Diagnosis } = await import("@/lib/services/analytics-v2.service");
      const classIdsArray = readInputStringArray(job, "classIds");
      const legacyClassId = readInputString(job, "classId");
      const classIds =
        classIdsArray.length > 0
          ? classIdsArray
          : legacyClassId
            ? [legacyClassId]
            : [];
      const diagnosis = await getAnalyticsV2Diagnosis({
        courseId,
        chapterId: readInputString(job, "chapterId") ?? undefined,
        sectionId: readInputString(job, "sectionId") ?? undefined,
        classIds: classIds.length > 0 ? classIds : undefined,
        taskType: readInputString(job, "taskType") as never,
        taskInstanceId: readInputString(job, "taskInstanceId") ?? undefined,
        scorePolicy: (readInputString(job, "scorePolicy") as never) ?? undefined,
        range: (readInputString(job, "range") as never) ?? undefined,
      });
      await updateAsyncJobProgress(job.id, 90);
      return diagnosis as unknown as JsonInput;
    }
    case "ai_work_assistant": {
      await updateAsyncJobProgress(job.id, 10);
      const { runAiWorkAssistantJob } = await import("@/lib/services/ai-work-assistant.service");
      return await runAiWorkAssistantJob(job.input, job.createdBy, (progress) =>
        updateAsyncJobProgress(job.id, progress).then(() => undefined),
      );
    }
    case "quiz_question_tag": {
      const taskId = readInputString(job, "taskId") || job.entityId;
      if (!taskId) throw new Error("TASK_NOT_FOUND");
      await updateAsyncJobProgress(job.id, 20);
      const { tagQuizQuestions } = await import("@/lib/services/quiz-question-tagger.service");
      const summary = await tagQuizQuestions(taskId, job.createdBy);
      await updateAsyncJobProgress(job.id, 95);
      return summary as unknown as JsonInput;
    }
    case "data_insight_advice":
      throw new Error("ASYNC_JOB_HANDLER_NOT_IMPLEMENTED");
  }
}

function readInputString(job: AsyncJob, key: string) {
  const input = job.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function readInputStringArray(job: AsyncJob, key: string): string[] {
  const input = job.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const value = (input as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
