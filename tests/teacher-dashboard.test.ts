import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findMany: vi.fn() },
    taskInstance: { findMany: vi.fn() },
    submission: { findMany: vi.fn(), count: vi.fn() },
    announcement: { findMany: vi.fn() },
    scheduleSlot: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getTeacherDashboard } from "@/lib/services/dashboard.service";

describe("getTeacherDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.course.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.submission.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("includes standalone task instances via OR on createdBy (courseId=null safe)", async () => {
    await getTeacherDashboard("teacher-1");

    const call = (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toEqual([
      // standalone（courseId=null）或非归档课程的本人实例
      { createdBy: "teacher-1", OR: [{ courseId: null }, { course: { deletedAt: null } }] },
      {
        course: {
          AND: [
            { OR: [{ createdBy: "teacher-1" }, { teachers: { some: { teacherId: "teacher-1" } } }] },
            { deletedAt: null },
          ],
        },
      },
    ]);
  });

  it("counts draft/published from returned task instances (including standalone ones)", async () => {
    (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ti-1", status: "draft", courseId: null },
      { id: "ti-2", status: "published", courseId: "course-1" },
      { id: "ti-3", status: "published", courseId: null },
    ]);

    const dashboard = await getTeacherDashboard("teacher-1");
    expect(dashboard.stats.draftCount).toBe(1);
    expect(dashboard.stats.publishedCount).toBe(2);
  });

  it("attaches live analytics (avgScore + submissionCount) computed from graded submissions", async () => {
    (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ti-A", status: "published", courseId: "c1" },
      { id: "ti-B", status: "published", courseId: "c1" },
      { id: "ti-C", status: "published", courseId: "c1" }, // no graded subs
    ]);
    // Two graded subs on ti-A (80%, 60% -> avg 70), one on ti-B (50%).
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "graded") {
          return Promise.resolve([
            { taskInstanceId: "ti-A", score: 80, maxScore: 100 },
            { taskInstanceId: "ti-A", score: 60, maxScore: 100 },
            { taskInstanceId: "ti-B", score: 5, maxScore: 10 },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const dashboard = await getTeacherDashboard("teacher-1");
    const byId = Object.fromEntries(
      dashboard.taskInstances.map((ti) => [ti.id, ti.analytics]),
    );
    expect(byId["ti-A"]).toEqual({ avgScore: 70, submissionCount: 2 });
    expect(byId["ti-B"]).toEqual({ avgScore: 50, submissionCount: 1 });
    expect(byId["ti-C"]).toBeNull();
  });

  it("scopes live analytics query to the returned instance ids only", async () => {
    (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ti-1", status: "published", courseId: "c1" },
      { id: "ti-2", status: "published", courseId: "c1" },
    ]);

    await getTeacherDashboard("teacher-1");

    const findManyCalls = (prisma.submission.findMany as ReturnType<typeof vi.fn>).mock.calls;
    const liveCall = findManyCalls.find(
      ([args]) => args?.where?.taskInstanceId?.in,
    );
    expect(liveCall).toBeDefined();
    expect(liveCall![0].where.taskInstanceId.in).toEqual(["ti-1", "ti-2"]);
    expect(liveCall![0].where.status).toBe("graded");
  });
});
