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
      { createdBy: "teacher-1" },
      {
        course: {
          OR: [{ createdBy: "teacher-1" }, { teachers: { some: { teacherId: "teacher-1" } } }],
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
});
