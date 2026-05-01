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
    case "task_import_parse":
    case "ai_work_assistant":
    case "analytics_recompute":
      throw new Error("ASYNC_JOB_HANDLER_NOT_IMPLEMENTED");
  }
}

function readInputString(job: AsyncJob, key: string) {
  const input = job.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
