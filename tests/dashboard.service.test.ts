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
    expect(call.where).toEqual({ classId: "class-A", status: "published" });
    expect(call.where.OR).toBeUndefined();
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
