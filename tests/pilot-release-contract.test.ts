import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: { submission: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() } } }));
vi.mock("@/lib/auth/resource-access", () => ({ assertTaskInstanceWritable: vi.fn(), assertSubmissionReadable: vi.fn() }));
vi.mock("@/lib/services/audit.service", () => ({ logAuditEvent: vi.fn() }));
import { prisma } from "@/lib/db/prisma";
import { unreleaseSubmission, autoReleaseSubmissions } from "@/lib/services/release.service";
beforeEach(() => vi.clearAllMocks());
describe("teacher withdrawal takes priority over automatic publication", () => {
  it("withdrawal records a durable suppression, even while a release schedule remains enabled", async () => {
    vi.mocked(prisma.submission.findUnique).mockResolvedValue({ id: "sub", status: "graded", taskInstanceId: "instance", deletedAt: null } as never);
    await unreleaseSubmission("sub", { id: "teacher", role: "teacher" });
    expect(prisma.submission.update).toHaveBeenCalledWith({ where: { id: "sub" }, data: { releasedAt: null, releaseSuppressedAt: expect.any(Date) } });
  });
  it("cron excludes withdrawn/deleted rows both when scanning and when writing after a racing withdrawal", async () => {
    vi.mocked(prisma.submission.findMany).mockResolvedValue([{ id: "sub", taskInstanceId: "instance" }] as never);
    vi.mocked(prisma.submission.updateMany).mockResolvedValue({ count: 0 });
    const result = await autoReleaseSubmissions(new Date());
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deletedAt: null, releaseSuppressedAt: null }) }));
    expect(prisma.submission.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deletedAt: null, releaseSuppressedAt: null, status: "graded" }) }));
    expect(result.released).toBe(0);
  });
});
