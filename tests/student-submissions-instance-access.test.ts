import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/prisma", () => ({ prisma: {
  taskInstance: { findUnique: vi.fn() }, submission: { findFirst: vi.fn() },
} }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/lib/services/submission.service", () => ({
  createSubmission: vi.fn(), getSubmissions: vi.fn(), stripSubmissionForStudent: (value: unknown) => value, deriveAnalysisStatus: vi.fn(),
}));
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { getSubmissions } from "@/lib/services/submission.service";
import { GET } from "@/app/api/submissions/route";

const instance = { id: "instance", classId: "class", courseId: "course", createdBy: "teacher", status: "published", course: { deletedAt: null } };
const get = () => GET(new NextRequest("http://localhost/api/submissions?taskInstanceId=instance"));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({ session: { user: { id: "student", role: "student", classId: "class" }, expires: "future" }, error: null });
  vi.mocked(prisma.taskInstance.findUnique).mockResolvedValue(instance as never);
  vi.mocked(getSubmissions).mockResolvedValue({ items: [{ id: "own-submission" }], total: 1, page: 1, pageSize: 20 } as never);
});

describe("student submission list with explicit instance", () => {
  it("rejects archived course access before returning submission content", async () => {
    vi.mocked(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, course: { deletedAt: new Date() } } as never);
    expect((await get()).status).toBe(403);
    expect(getSubmissions).not.toHaveBeenCalled();
  });
  it("rejects a prior class after reassignment", async () => {
    vi.mocked(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, classId: "previous-class" } as never);
    expect((await get()).status).toBe(403);
    expect(getSubmissions).not.toHaveBeenCalled();
  });
  it("keeps published and closed own-submission review available", async () => {
    expect((await get()).status).toBe(200);
    vi.mocked(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, status: "closed" } as never);
    vi.mocked(prisma.submission.findFirst).mockResolvedValue({ id: "own-submission" } as never);
    expect((await get()).status).toBe(200);
    expect(prisma.submission.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { taskInstanceId: "instance", studentId: "student", deletedAt: null } }));
  });
  it("rejects closed instances without an own submission and draft instances", async () => {
    vi.mocked(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, status: "closed" } as never);
    vi.mocked(prisma.submission.findFirst).mockResolvedValue(null);
    expect((await get()).status).toBe(403);
    vi.mocked(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, status: "draft" } as never);
    expect((await get()).status).toBe(403);
    expect(getSubmissions).not.toHaveBeenCalled();
  });
});
