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
import { getStudentDashboard } from "@/lib/services/dashboard.service";

describe("getStudentDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.course.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("queries taskInstances scoped strictly to the student's classId (no cross-class leakage)", async () => {
    (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getStudentDashboard("student-1", "class-A");

    const call = (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Unit 3: 拉 published + closed，但 closed 后续会按"我有 submission"过滤
    // U3-归档: 加 OR[courseId=null | course.deletedAt=null]，已归档课程任务对学生消失（保留 standalone）
    expect(call.where).toEqual({
      classId: "class-A",
      status: { in: ["published", "closed"] },
      OR: [{ courseId: null }, { course: { deletedAt: null } }],
    });
  });

  it("Unit 3: closed instance with my submission is kept; closed without is dropped", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 3600 * 1000);
    (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ti-pub", classId: "class-A", status: "published", dueAt: past, attemptsAllowed: null, task: {}, course: {} },
      { id: "ti-closed-mine", classId: "class-A", status: "closed", dueAt: past, attemptsAllowed: null, task: {}, course: {} },
      { id: "ti-closed-other", classId: "class-A", status: "closed", dueAt: past, attemptsAllowed: null, task: {}, course: {} },
    ]);
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "sub-1", taskId: "t1", taskInstanceId: "ti-closed-mine", status: "graded", score: 80, maxScore: 100, submittedAt: past, gradedAt: past, releasedAt: past },
    ]);

    const result = await getStudentDashboard("student-1", "class-A");
    const ids = result.tasks.map((t) => t.id);
    expect(ids).toContain("ti-pub");
    expect(ids).toContain("ti-closed-mine");
    expect(ids).not.toContain("ti-closed-other");
    const mine = result.tasks.find((t) => t.id === "ti-closed-mine");
    expect(mine?.latestSubmissionId).toBe("sub-1");
  });

  it("does not leak tasks assigned to other classes of the same course", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 24 * 3600 * 1000);
    (prisma.taskInstance.findMany as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { where: { classId: string; status: string } }) => {
        const all = [
          { id: "ti-A", classId: "class-A", status: "published", dueAt: future, attemptsAllowed: null, task: {}, course: {} },
          { id: "ti-B", classId: "class-B", status: "published", dueAt: future, attemptsAllowed: null, task: {}, course: {} },
        ];
        return Promise.resolve(all.filter((t) => t.classId === args.where.classId));
      }
    );

    const result = await getStudentDashboard("student-1", "class-B");

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("ti-B");
    expect(result.tasks.find((t) => t.id === "ti-A")).toBeUndefined();
  });
});
