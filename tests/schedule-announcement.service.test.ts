import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    scheduleSlot: { findMany: vi.fn() },
    announcement: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getScheduleSlots } from "@/lib/services/schedule.service";
import { getAnnouncements } from "@/lib/services/announcement.service";

describe("getScheduleSlots with classId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses courseClassFilter so the class hits the parent course schedule (CourseClass M:N only)", async () => {
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getScheduleSlots({ classId: "class-secondary" });

    const call = (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.course).toEqual({
      AND: [{ classes: { some: { classId: "class-secondary" } } }, { deletedAt: null }],
    });
  });

  it("selects course.semesterStartDate (needed by ThisWeek filter)", async () => {
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getScheduleSlots({ teacherId: "t-1" });

    const call = (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.include.course.select.semesterStartDate).toBe(true);
    expect(call.include.course.select.courseTitle).toBe(true);
    // Course.classId 已弃用，select 不再包含
    expect(call.include.course.select.classId).toBeUndefined();
  });

  it("combines classId + teacherId via AND (no spread key collision)", async () => {
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getScheduleSlots({ classId: "class-x", teacherId: "t-2" });

    const call = (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.course).toEqual({
      AND: [
        { AND: [{ classes: { some: { classId: "class-x" } } }, { deletedAt: null }] },
        { AND: [{ OR: [{ createdBy: "t-2" }, { teachers: { some: { teacherId: "t-2" } } }] }, { deletedAt: null }] },
      ],
    });
  });

  it("courseId only: no course filter in where", async () => {
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getScheduleSlots({ courseId: "c-1" });

    const call = (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toEqual({ courseId: "c-1" });
  });
});

describe("getAnnouncements with classId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses courseClassFilter so the class sees parent course announcements (CourseClass M:N only)", async () => {
    (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getAnnouncements({ classId: "class-secondary" });

    const call = (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.course).toEqual({
      AND: [{ classes: { some: { classId: "class-secondary" } } }, { deletedAt: null }],
    });
  });

  it("teacherId filter scopes to owned + CourseTeacher courses", async () => {
    (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getAnnouncements({ teacherId: "t-5" });

    const call = (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.course).toEqual({
      AND: [{ OR: [{ createdBy: "t-5" }, { teachers: { some: { teacherId: "t-5" } } }] }, { deletedAt: null }],
    });
  });

  it("no filter = no course restriction (admin全局视角)", async () => {
    (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getAnnouncements({});

    const call = (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.course).toBeUndefined();
  });
});
