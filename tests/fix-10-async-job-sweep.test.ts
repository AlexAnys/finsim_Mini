import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AsyncJob } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({ prisma: {
  asyncJob: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  submission: { findUnique: vi.fn() },
} }));
vi.mock("@/lib/services/grading.service", () => ({ gradeSubmission: vi.fn() }));
import { prisma } from "@/lib/db/prisma";
import { runAsyncJob, sweepStuckJobs } from "@/lib/services/async-job.service";
import { getCurrentJobLease } from "@/lib/services/async-job-context";
import { gradeSubmission } from "@/lib/services/grading.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
let job: AsyncJob;
const now = new Date("2026-09-09T12:00:00Z");
beforeEach(() => {
  vi.resetAllMocks();
  job = { id: "job", type: "submission_grade", status: "queued", attempts: 0, maxAttempts: 3,
    createdAt: new Date(now.getTime() - 12 * 60_000), startedAt: null, entityId: "sub", input: null,
    createdBy: "teacher", progress: 0, error: null, result: null, completedAt: null, entityType: "Submission", updatedAt: now,
  };
  mk(prisma.asyncJob.findUnique).mockImplementation(async () => ({ ...job }));
  mk(prisma.asyncJob.findMany).mockImplementation(async (args) => job.status === args?.where?.status ? [{ ...job }] : []);
  mk(prisma.asyncJob.updateMany).mockImplementation(async (args) => {
    if (args.where?.status !== job.status || (args.where?.attempts != null && args.where.attempts !== job.attempts)) return { count: 0 };
    const data = args.data as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (key === "attempts") job.attempts += (value as { increment: number }).increment;
      else Object.assign(job, { [key]: value });
    }
    return { count: 1 };
  });
  vi.mocked(prisma.submission.findUnique).mockResolvedValue({ id: "sub", status: "graded", score: null, maxScore: null } as never);
  vi.mocked(gradeSubmission).mockResolvedValue(undefined);
});

describe("async recovery leases", () => {
  it("recovers a queued job and counts its final successful status", async () => {
    const result = await sweepStuckJobs({ now });
    expect(job.status).toBe("succeeded");
    expect(job.attempts).toBe(1);
    expect(result).toMatchObject({ triggered: 1, succeeded: 1, failed: 0 });
  });
  it("counts a handled failure as failed, not a fulfilled-promise success", async () => {
    vi.mocked(gradeSubmission).mockRejectedValue(new Error("upstream failed"));
    const result = await sweepStuckJobs({ now });
    expect(job.status).toBe("failed");
    expect(result).toMatchObject({ succeeded: 0, failed: 1 });
  });
  it("requeues a stuck running attempt and passes the incremented lease to grading", async () => {
    job.status = "running"; job.attempts = 1; job.startedAt = job.createdAt;
    let lease;
    vi.mocked(gradeSubmission).mockImplementation(async () => { lease = getCurrentJobLease(); });
    const result = await sweepStuckJobs({ now });
    expect(lease).toEqual({ jobId: "job", attempt: 2 });
    expect(result.requeuedRunning).toBe(1);
    expect(job.status).toBe("succeeded");
  });
  it("gives up after the configured maximum", async () => {
    job.status = "running"; job.attempts = 3; job.startedAt = job.createdAt;
    const result = await sweepStuckJobs({ now });
    expect(job.status).toBe("failed");
    expect(job.error).toBe("STUCK_TIMEOUT_GAVE_UP");
    expect(result.markedFailed).toBe(1);
    expect(gradeSubmission).not.toHaveBeenCalled();
  });
  it("rejects final writes from an older attempt while a newer worker runs", async () => {
    let release!: () => void;
    const started = new Promise<void>((resolve) => vi.mocked(gradeSubmission).mockImplementation(async () => {
      resolve(); await new Promise<void>((done) => { release = done; });
    }));
    const oldWorker = runAsyncJob("job");
    await started;
    expect(job.attempts).toBe(1);
    job.attempts = 2; // sweeper has granted a new execution lease
    release(); await oldWorker;
    expect(job.status).toBe("running");
    expect(job.attempts).toBe(2);
  });
  it("does not count another worker's running job as successful", async () => {
    vi.mocked(prisma.asyncJob.findMany).mockResolvedValueOnce([{ id: "job" }] as never).mockResolvedValueOnce([]);
    job.status = "running";
    const result = await sweepStuckJobs({ now });
    expect(result).toMatchObject({ triggered: 1, succeeded: 0, failed: 0 });
    expect(gradeSubmission).not.toHaveBeenCalled();
  });
  it("has nothing to trigger when no jobs need recovery", async () => {
    vi.mocked(prisma.asyncJob.findMany).mockResolvedValue([]);
    expect(await sweepStuckJobs({ now })).toMatchObject({ triggered: 0, succeeded: 0, failed: 0 });
  });
});
