import { describe, it, expect } from "vitest";
import {
  deriveHeroMeta,
  buildHeroSubtitle,
} from "@/components/schedule/schedule-hero";
import type { SemesterHeaderCourse } from "@/components/schedule/semester-header";
import type { ThisWeekSlot } from "@/lib/utils/this-week-schedule";

function course(
  id: string,
  semesterStartDate: string | null
): SemesterHeaderCourse {
  return {
    id,
    courseTitle: `课 ${id}`,
    semesterStartDate,
  };
}

function slot(opts: {
  id?: string;
  dayOfWeek: number;
  startWeek?: number;
  endWeek?: number;
  weekType?: string;
  semesterStartDate: string | null;
}): ThisWeekSlot {
  return {
    id: opts.id ?? `s-${opts.dayOfWeek}`,
    courseId: "c-1",
    dayOfWeek: opts.dayOfWeek,
    slotIndex: 1,
    startWeek: opts.startWeek ?? 1,
    endWeek: opts.endWeek ?? 16,
    timeLabel: "08:30-10:05",
    classroom: null,
    weekType: opts.weekType ?? "all",
    course: {
      courseTitle: "测试课",
      semesterStartDate: opts.semesterStartDate,
    },
  };
}

describe("deriveHeroMeta", () => {
  // 周一 2026-04-27 = 学期开始 2026-02-23 后第 10 周（双周）
  const semStart = "2026-02-23T00:00:00.000Z"; // Monday
  const monday = new Date("2026-04-27T10:00:00.000Z"); // Monday, week 10

  it("returns weekNumber 0 when no course has semesterStartDate", () => {
    const meta = deriveHeroMeta(
      [course("c1", null), course("c2", null)],
      [],
      monday
    );
    expect(meta.weekNumber).toBe(0);
    expect(meta.todayCount).toBe(0);
  });

  it("uses earliest semesterStartDate among courses to compute week number", () => {
    const earlier = "2026-02-16T00:00:00.000Z"; // Mon
    const later = "2026-03-02T00:00:00.000Z"; // Mon
    const meta = deriveHeroMeta(
      [course("late", later), course("early", earlier)],
      [],
      monday
    );
    // 2026-04-27 - 2026-02-16 = 70 days = 10 weeks → weekNumber 11
    expect(meta.weekNumber).toBe(11);
    expect(meta.weekType).toBe("单周");
  });

  it("computes single week (单周) for odd week number", () => {
    const meta = deriveHeroMeta(
      [course("c1", "2026-04-20T00:00:00.000Z")], // week 1 = 04-20
      [],
      monday
    );
    expect(meta.weekNumber).toBe(2);
    expect(meta.weekType).toBe("双周");
  });

  it("counts today's slots correctly (Monday today)", () => {
    const meta = deriveHeroMeta(
      [course("c1", semStart)],
      [
        slot({ id: "s1", dayOfWeek: 1, semesterStartDate: semStart }), // Mon (today)
        slot({ id: "s2", dayOfWeek: 1, semesterStartDate: semStart }), // Mon (today)
        slot({ id: "s3", dayOfWeek: 2, semesterStartDate: semStart }), // Tue (not today)
      ],
      monday
    );
    expect(meta.todayCount).toBe(2);
  });

  it("excludes slots whose course has no semesterStartDate from today count", () => {
    const meta = deriveHeroMeta(
      [course("c1", semStart)],
      [
        slot({ id: "s1", dayOfWeek: 1, semesterStartDate: semStart }),
        slot({ id: "s2", dayOfWeek: 1, semesterStartDate: null }), // skipped
      ],
      monday
    );
    expect(meta.todayCount).toBe(1);
  });

  it("respects weekType odd/even when counting today's slots", () => {
    // monday is week 10 → 双周 (even)
    const meta = deriveHeroMeta(
      [course("c1", semStart)],
      [
        slot({
          id: "s-odd",
          dayOfWeek: 1,
          weekType: "odd",
          semesterStartDate: semStart,
        }), // 单周 only → excluded in week 10
        slot({
          id: "s-even",
          dayOfWeek: 1,
          weekType: "even",
          semesterStartDate: semStart,
        }), // 双周 only → included
        slot({
          id: "s-all",
          dayOfWeek: 1,
          weekType: "all",
          semesterStartDate: semStart,
        }), // included
      ],
      monday
    );
    expect(meta.todayCount).toBe(2);
  });

  it("respects startWeek/endWeek bounds", () => {
    const meta = deriveHeroMeta(
      [course("c1", semStart)],
      [
        slot({
          id: "s1",
          dayOfWeek: 1,
          startWeek: 1,
          endWeek: 5,
          semesterStartDate: semStart,
        }), // out of range (week 10)
        slot({
          id: "s2",
          dayOfWeek: 1,
          startWeek: 8,
          endWeek: 12,
          semesterStartDate: semStart,
        }), // in range
      ],
      monday
    );
    expect(meta.todayCount).toBe(1);
  });

  it("Sunday treated as dayOfWeek=7 (ISO)", () => {
    const sunday = new Date("2026-05-03T10:00:00.000Z"); // Sunday
    const meta = deriveHeroMeta(
      [course("c1", semStart)],
      [
        slot({ id: "s7", dayOfWeek: 7, semesterStartDate: semStart }),
        slot({ id: "s1", dayOfWeek: 1, semesterStartDate: semStart }),
      ],
      sunday
    );
    expect(meta.todayCount).toBe(1);
  });
});

describe("buildHeroSubtitle", () => {
  it("renders standard subtitle when semester started", () => {
    const text = buildHeroSubtitle({
      weekNumber: 6,
      weekType: "双周",
      todayCount: 3,
    });
    expect(text).toBe("第 6 周 · 双周 · 今天 3 节课");
  });

  it("renders 学期未开始 fallback when weekNumber=0", () => {
    const text = buildHeroSubtitle({
      weekNumber: 0,
      weekType: "双周",
      todayCount: 0,
    });
    expect(text).toBe("学期未开始 · 今天 0 节课");
  });

  it("renders 单周 label correctly", () => {
    const text = buildHeroSubtitle({
      weekNumber: 5,
      weekType: "单周",
      todayCount: 2,
    });
    expect(text).toBe("第 5 周 · 单周 · 今天 2 节课");
  });
});
