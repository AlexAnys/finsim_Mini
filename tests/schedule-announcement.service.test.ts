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

  it("uses courseClassFilter so a secondary class hits the parent course schedule", async () => {
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getScheduleSlots({ classId: "class-secondary" });

    const call = (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.course).toEqual({
      OR: [{ classId: "class-secondary" }, { classes: { some: { classId: "class-secondary" } } }],
    });
  });

  it("selects course.semesterStartDate (needed by ThisWeek filter)", async () => {
    (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getScheduleSlots({ teacherId: "t-1" });

    const call = (prisma.scheduleSlot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.include.course.select.semesterStartDate).toBe(true);
    expect(call.include.course.select.courseTitle).toBe(true);
    expect(call.include.course.select.classId).toBe(true);
  });
});

describe("getAnnouncements with classId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses courseClassFilter so a secondary class sees parent course announcements", async () => {
    (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getAnnouncements({ classId: "class-secondary" });

    const call = (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.course).toEqual({
      OR: [{ classId: "class-secondary" }, { classes: { some: { classId: "class-secondary" } } }],
    });
  });
});
