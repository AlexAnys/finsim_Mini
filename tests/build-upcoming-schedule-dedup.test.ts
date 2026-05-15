import { describe, it, expect } from "vitest";
import { buildUpcomingSchedule } from "@/lib/utils/teacher-dashboard-transforms";

const baseCourse = (id: string, title = "个人理财规划") => ({
  id,
  courseTitle: title,
  classId: "cls-A",
  semesterStartDate: null,
  class: { id: "cls-A", name: "金融2024A班" },
});

describe("buildUpcomingSchedule — dedup", () => {
  // Force a deterministic 'now' so dayOffset / dayOfWeek line up reliably.
  const now = new Date("2026-05-14T09:00:00Z"); // Thursday => getDay() == 4
  const slotDayOfWeek = 4; // Thursday — must match `now.getDay()` to fall on dayOffset=0

  it("returns one row per distinct (slotId, date) pair (no schema-level dup) — baseline", () => {
    const slots = [
      {
        id: "slot-1",
        courseId: "course-1",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "A101",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-1"),
      },
    ];
    const out = buildUpcomingSchedule(slots, 4, now);
    expect(out).toHaveLength(1);
    expect(out[0].courseTitle).toBe("个人理财规划");
  });

  it("dedupes visual duplicates — 3 different courseIds with same title/class/time render as 1", () => {
    // 模拟 dev DB 真实状态：teacher1 重复造了 3 个 Course title="个人理财规划"
    const slots = [
      {
        id: "slot-A",
        courseId: "course-A",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "A101",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-A"),
      },
      {
        id: "slot-B",
        courseId: "course-B",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "A101",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-B"),
      },
      {
        id: "slot-C",
        courseId: "course-C",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "A101",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-C"),
      },
    ];
    const out = buildUpcomingSchedule(slots, 4, now);
    expect(out).toHaveLength(1);
    expect(out[0].courseTitle).toBe("个人理财规划");
  });

  it("preserves different courses with different titles even at same time", () => {
    const slots = [
      {
        id: "slot-A",
        courseId: "course-A",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "A101",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-A", "个人理财规划"),
      },
      {
        id: "slot-B",
        courseId: "course-B",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "B201",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-B", "投资学"),
      },
    ];
    const out = buildUpcomingSchedule(slots, 4, now);
    expect(out).toHaveLength(2);
    const titles = out.map((s) => s.courseTitle).sort();
    expect(titles).toEqual(["个人理财规划", "投资学"]);
  });

  it("preserves same course title across different days (not deduped if date differs)", () => {
    const slots = [
      {
        id: "slot-thu",
        courseId: "course-1",
        dayOfWeek: 4, // Thursday
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "A101",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-1"),
      },
      {
        id: "slot-fri",
        courseId: "course-1",
        dayOfWeek: 5, // Friday
        slotIndex: 1,
        timeLabel: "10:00-11:40",
        classroom: "A101",
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-1"),
      },
    ];
    const out = buildUpcomingSchedule(slots, 4, now);
    expect(out).toHaveLength(2);
    const dates = out.map((s) => s.date).sort();
    // Thursday today + Friday tomorrow
    expect(dates[0]).not.toBe(dates[1]);
  });

  it("dedupes when className is identical and timeLabel + date match", () => {
    const slots = [
      {
        id: "slot-x",
        courseId: "course-x",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "14:00-15:40",
        classroom: null,
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-x", "金融工程"),
      },
      {
        id: "slot-y",
        courseId: "course-y",
        dayOfWeek: slotDayOfWeek,
        slotIndex: 1,
        timeLabel: "14:00-15:40",
        classroom: null,
        weekType: "all",
        startWeek: 1,
        endWeek: 20,
        course: baseCourse("course-y", "金融工程"),
      },
    ];
    const out = buildUpcomingSchedule(slots, 4, now);
    expect(out).toHaveLength(1);
  });
});
