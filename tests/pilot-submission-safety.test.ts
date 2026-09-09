import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  $queryRaw: vi.fn(), $transaction: vi.fn(), taskInstance: { findUnique: vi.fn() }, user: { findUnique: vi.fn() },
  submission: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  subjectiveSubmission: { create: vi.fn(), update: vi.fn() }, quizSubmission: { create: vi.fn(), update: vi.fn() },
  fileUpload: { findUnique: vi.fn() }, asyncJob: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  analysisReport: { updateMany: vi.fn() }, auditLog: { create: vi.fn() }, quizAttempt: { findUnique: vi.fn() },
} }));
vi.mock("@/lib/services/async-job.service", () => ({ scheduleAsyncJob: vi.fn() }));
vi.mock("@/lib/services/insight-invalidation", () => ({ invalidateSubmissionInsights: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/resource-access", () => ({ assertSubmissionReadable: vi.fn(async () => {}) }));
import { prisma } from "@/lib/db/prisma";
import { createSubmission, updateSubmissionGrade, batchDeleteSubmissions, restoreSubmission, getSubmissions } from "@/lib/services/submission.service";
import { withJobLease } from "@/lib/services/async-job-context";
const instance = { id: "instance", taskId: "task", taskType: "subjective", status: "published", classId: "class", contentVersion: 1, attemptsAllowed: 1, course: null, taskSnapshot: null,
  task: { id: "task", taskName: "报告", taskType: "subjective", subjectiveConfig: { allowedAttachmentTypes: ["pdf"] }, scoringCriteria: [], quizQuestions: [] } };
const input = { requestId: "request", taskId: "task", taskInstanceId: "instance", taskType: "subjective" as const, textAnswer: "完整答案", taskVersion: 1 };
const fn = (value: unknown) => value as ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  fn(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
  fn(prisma.$queryRaw).mockResolvedValue([]);
  fn(prisma.taskInstance.findUnique).mockResolvedValue(instance);
  fn(prisma.user.findUnique).mockResolvedValue({ role: "student", classId: "class" });
  fn(prisma.submission.count).mockResolvedValue(0);
  fn(prisma.submission.create).mockResolvedValue({ id: "sub", status: "submitted" });
  fn(prisma.asyncJob.create).mockResolvedValue({ id: "job", status: "queued" });
});
describe("pilot submission transaction boundaries", () => {
  it("a repeated request returns the same submission without creating or charging another attempt", async () => {
    fn(prisma.submission.findUnique).mockResolvedValue({ id: "old", taskInstanceId: "instance", status: "graded", deletedAt: null });
    fn(prisma.asyncJob.findFirst).mockResolvedValue({ id: "job-old", status: "succeeded" });
    expect((await createSubmission("student", input)).id).toBe("old");
    expect(prisma.submission.create).not.toHaveBeenCalled(); expect(prisma.asyncJob.create).not.toHaveBeenCalled();
  });
  it("a stale runner version is rejected instead of receiving a score for another version", async () => {
    await expect(createSubmission("student", { ...input, taskVersion: 2 })).rejects.toThrow("TASK_VERSION_CHANGED");
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });
  it("attempt limits are checked inside the instance transaction", async () => {
    fn(prisma.submission.count).mockResolvedValue(1);
    await expect(createSubmission("student", input)).rejects.toThrow("MAX_ATTEMPTS_REACHED");
    expect(prisma.submission.create).not.toHaveBeenCalled(); expect(prisma.$queryRaw).toHaveBeenCalled();
  });
  it("a known foreign upload cannot be attached or used to grant file access", async () => {
    fn(prisma.fileUpload.findUnique).mockResolvedValue({ id: "upload", ownerId: "other", fileName: "answer.pdf" });
    await expect(createSubmission("student", { ...input, attachments: [{ uploadId: "upload", fileName: "answer.pdf", filePath: "known.pdf", fileSize: 4, contentType: "application/pdf" }] })).rejects.toThrow("ATTACHMENT_FORBIDDEN");
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });
  it("submission and queued grading job are created by the same transaction", async () => {
    await createSubmission("student", input);
    expect(prisma.submission.create).toHaveBeenCalledWith({ data: expect.objectContaining({ requestId: "request", taskSnapshot: expect.objectContaining({ taskName: "报告" }) }) });
    expect(prisma.asyncJob.create).toHaveBeenCalledWith({ data: expect.objectContaining({ entityId: "sub", type: "submission_grade" }) });
  });
  it("an obsolete job lease cannot write a score", async () => {
    fn(prisma.$queryRaw).mockResolvedValue([{ status: "running", attempts: 2 }]);
    await expect(withJobLease({ jobId: "job", attempt: 1 }, () => updateSubmissionGrade("sub", { status: "graded", score: 0 }))).rejects.toThrow("ASYNC_JOB_LEASE_LOST");
    expect(prisma.submission.update).not.toHaveBeenCalled();
  });
  it("even a current worker cannot overwrite a teacher's already completed grade", async () => {
    fn(prisma.$queryRaw).mockResolvedValue([{ status: "running", attempts: 1 }]);
    fn(prisma.submission.findUnique).mockResolvedValue({ id: "sub", status: "graded", deletedAt: null });
    await expect(withJobLease({ jobId: "job", attempt: 1 }, () => updateSubmissionGrade("sub", { status: "graded", score: 0 }))).rejects.toThrow("ASYNC_JOB_LEASE_LOST");
    expect(prisma.submission.update).not.toHaveBeenCalled();
  });
  it("teacher-only student filtering always intersects the authorized resource scope", async () => {
    fn(prisma.submission.findMany).mockResolvedValue([]);
    await getSubmissions({ studentId: "victim", actor: { id: "teacher", role: "teacher" } });
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ studentId: "victim", deletedAt: null, AND: [expect.objectContaining({ OR: expect.any(Array) })] }) }));
  });
  it("delete keeps records, cancels jobs and records an audit event; restore clears the tombstone", async () => {
    fn(prisma.submission.findMany).mockResolvedValue([{ id: "sub", taskId: "task", taskInstanceId: "instance", score: null, maxScore: null, status: "graded" }]);
    fn(prisma.submission.updateMany).mockResolvedValue({ count: 1 });
    await batchDeleteSubmissions(["sub"], { id: "teacher", role: "teacher" });
    expect(prisma.submission.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: "teacher" }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "submission.delete" }) }));
    fn(prisma.submission.findUnique).mockResolvedValue({ id: "sub", status: "graded", deletedAt: new Date() });
    fn(prisma.submission.update).mockResolvedValue({ id: "sub", taskId: "task", status: "graded" });
    await restoreSubmission("sub", { id: "teacher", role: "teacher" });
    expect(prisma.submission.update).toHaveBeenCalledWith(expect.objectContaining({ data: { deletedAt: null, deletedBy: null } }));
  });
});
