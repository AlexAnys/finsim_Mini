import { describe, it, expect } from "vitest";
import { deriveNextLesson, type NextLessonSlot } from "@/lib/utils/next-lesson";

function makeSlot(override: Partial<NextLessonSlot>): NextLessonSlot {
  return {
    id: "slot-1",
    courseId: "c1",
    course: { id: "c1", courseTitle: "金融市场" },
    dayOfWeek: 1,
    timeLabel: "08:00-09:40",
    classroom: "A301",
    startWeek: 1,
    endWeek: 16,
    weekType: "all",
    ...override,
  };
}

describe("deriveNextLesson", () => {
  it("returns null when no slots match the course", () => {
    const now = new Date("2026-04-23T10:00:00");
    const slots = [makeSlot({ courseId: "other", course: { id: "other" } })];
    expect(deriveNextLesson("c1", slots, now)).toBeNull();
  });

  it("returns today's upcoming slot if start time is still in future", () => {
    const now = new Date("2026-04-23T07:00:00"); // Thursday (dayOfWeek=4)
    const slots = [
      makeSlot({
        dayOfWeek: 4,
        timeLabel: "08:00-09:40",
        classroom: "A301",
      }),
    ];
    const r = deriveNextLesson("c1", slots, now);
    expect(r).not.toBeNull();
    expect(r!.date).toContain("今天");
    expect(r!.classroom).toBe("A301");
  });

  it("pushes to next week when today's slot has already passed", () => {
    const now = new Date("2026-04-23T10:00:00"); // Thursday
    const slots = [
      makeSlot({ dayOfWeek: 4, timeLabel: "08:00-09:40" }), // earlier today
    ];
    const r = deriveNextLesson("c1", slots, now);
    expect(r).not.toBeNull();
    // 7 days ahead → prefixed "下" + weekday
    expect(r!.date.startsWith("下")).toBe(true);
  });

  it("uses '明天' when target is exactly 1 day ahead", () => {
    const now = new Date("2026-04-23T10:00:00"); // Thursday = dayOfWeek 4
    const slots = [makeSlot({ dayOfWeek: 5, timeLabel: "10:25-12:05" })]; // Friday
    const r = deriveNextLesson("c1", slots, now);
    expect(r!.date).toContain("明天");
  });

  it("uses weekday label (e.g. 周六) for 2-6 days ahead", () => {
    const now = new Date("2026-04-23T10:00:00"); // Thursday
    const slots = [makeSlot({ dayOfWeek: 6, timeLabel: "14:00-15:40" })]; // Saturday
    const r = deriveNextLesson("c1", slots, now);
    expect(r!.date).toContain("周六");
  });

  it("picks the earliest upcoming slot when multiple exist for same course", () => {
    const now = new Date("2026-04-23T10:00:00"); // Thursday
    const slots = [
      makeSlot({ id: "s1", dayOfWeek: 6, timeLabel: "14:00-15:40" }),
      makeSlot({ id: "s2", dayOfWeek: 5, timeLabel: "10:25-12:05" }),
    ];
    const r = deriveNextLesson("c1", slots, now);
    expect(r!.date).toContain("明天");
  });

  it("skips slots outside startWeek/endWeek range", () => {
    const now = new Date("2026-04-23T10:00:00");
    // semester started 2 weeks ago so weekNumber=3, but slot's endWeek=2 → excluded
    const slots = [
      makeSlot({
        startWeek: 1,
        endWeek: 2,
        course: {
          id: "c1",
          courseTitle: "金融市场",
          semesterStartDate: "2026-04-06",
        },
      }),
    ];
    expect(deriveNextLesson("c1", slots, now)).toBeNull();
  });

  it("uses course id from course.id if present, else falls back to courseId field", () => {
    const now = new Date("2026-04-23T07:00:00");
    const slots: NextLessonSlot[] = [
      {
        id: "slot-x",
        courseId: "c1",
        course: undefined,
        dayOfWeek: 4,
        timeLabel: "08:00-09:40",
        classroom: null,
        startWeek: 1,
        endWeek: 16,
        weekType: "all",
      },
    ];
    const r = deriveNextLesson("c1", slots, now);
    expect(r).not.toBeNull();
    expect(r!.title).toBe("课程");
    expect(r!.classroom).toBeNull();
  });
});
