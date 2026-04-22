import { describe, it, expect } from "vitest";
import {
  filterThisWeekSlots,
  getThisWeekRange,
  isInThisWeek,
  type ThisWeekSlot,
} from "@/lib/utils/this-week-schedule";

function slot(
  id: string,
  opts: {
    startWeek?: number;
    endWeek?: number;
    weekType?: string;
    semesterStartDate?: string | null;
    dayOfWeek?: number;
  }
): ThisWeekSlot {
  return {
    id,
    courseId: "c-1",
    dayOfWeek: opts.dayOfWeek ?? 1,
    slotIndex: 1,
    startWeek: opts.startWeek ?? 1,
    endWeek: opts.endWeek ?? 16,
    timeLabel: "08:30-10:05",
    classroom: null,
    weekType: opts.weekType ?? "all",
    course: {
      courseTitle: "测试课程",
      semesterStartDate: opts.semesterStartDate ?? null,
    },
  };
}

describe("filterThisWeekSlots", () => {
  it("skips slots whose course has no semesterStartDate", () => {
    const now = new Date("2026-04-22T10:00:00.000Z");
    const s = slot("s1", { semesterStartDate: null });
    expect(filterThisWeekSlots([s], now)).toEqual([]);
  });

  it("skips slots when the semester hasn't started yet", () => {
    const now = new Date("2026-02-01T10:00:00.000Z");
    const s = slot("s1", {
      semesterStartDate: "2026-03-01T00:00:00.000Z",
    });
    expect(filterThisWeekSlots([s], now)).toEqual([]);
  });

  it("keeps slot when current week is within [startWeek, endWeek] and weekType=all", () => {
    // semester starts 2026-02-16 (Monday), now is 2026-03-01 → week 3
    const now = new Date("2026-03-01T10:00:00.000Z");
    const s = slot("s1", {
      semesterStartDate: "2026-02-16T00:00:00.000Z",
      startWeek: 1,
      endWeek: 16,
      weekType: "all",
    });
    expect(filterThisWeekSlots([s], now).map((x) => x.id)).toEqual(["s1"]);
  });

  it("filters out slot when current week > endWeek", () => {
    // 2026-02-16 + 17 weeks is beyond endWeek=16
    const now = new Date("2026-06-20T10:00:00.000Z");
    const s = slot("s1", {
      semesterStartDate: "2026-02-16T00:00:00.000Z",
      startWeek: 1,
      endWeek: 16,
    });
    expect(filterThisWeekSlots([s], now)).toEqual([]);
  });

  it("filters out slot when current week is odd but weekType=even", () => {
    // semester starts 2026-02-16 (week 1); 2026-02-23 is week 2 (even)
    // pick 2026-02-20 which is in week 1 (odd)
    const now = new Date("2026-02-20T10:00:00.000Z");
    const s = slot("s1", {
      semesterStartDate: "2026-02-16T00:00:00.000Z",
      weekType: "even",
    });
    expect(filterThisWeekSlots([s], now)).toEqual([]);
  });

  it("keeps slot when current week is odd and weekType=odd", () => {
    const now = new Date("2026-02-20T10:00:00.000Z");
    const s = slot("s1", {
      semesterStartDate: "2026-02-16T00:00:00.000Z",
      weekType: "odd",
    });
    expect(filterThisWeekSlots([s], now).map((x) => x.id)).toEqual(["s1"]);
  });

  it("handles mixed list — keeps valid, drops invalid", () => {
    const now = new Date("2026-02-20T10:00:00.000Z");
    const list = [
      slot("ok", {
        semesterStartDate: "2026-02-16T00:00:00.000Z",
        weekType: "all",
      }),
      slot("no-start", { semesterStartDate: null }),
      slot("out-of-range", {
        semesterStartDate: "2026-02-16T00:00:00.000Z",
        startWeek: 5,
        endWeek: 8,
      }),
    ];
    expect(filterThisWeekSlots(list, now).map((x) => x.id)).toEqual(["ok"]);
  });
});

describe("getThisWeekRange", () => {
  it("Monday-based week: for a Wednesday, start is the preceding Monday", () => {
    // 2026-04-22 is a Wednesday
    const now = new Date("2026-04-22T15:00:00.000Z");
    const { start, end } = getThisWeekRange(now);
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0); // Sunday
    // 6 days span
    expect(end.getTime() - start.getTime()).toBeGreaterThan(5 * 24 * 3600 * 1000);
  });

  it("for a Sunday, start is the preceding Monday (not the following)", () => {
    // 2026-04-26 is a Sunday
    const now = new Date("2026-04-26T10:00:00.000Z");
    const { start, end } = getThisWeekRange(now);
    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
    // now should be within [start, end]
    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(end.getTime());
  });
});

describe("isInThisWeek", () => {
  it("returns true for an ISO date within this week", () => {
    const now = new Date("2026-04-22T10:00:00.000Z");
    // Friday 2026-04-24 should be within the same ISO week
    expect(isInThisWeek("2026-04-24T10:00:00.000Z", now)).toBe(true);
  });

  it("returns false for a date outside this week", () => {
    const now = new Date("2026-04-22T10:00:00.000Z");
    expect(isInThisWeek("2026-05-10T00:00:00.000Z", now)).toBe(false);
  });

  it("returns false for an invalid ISO string", () => {
    const now = new Date("2026-04-22T10:00:00.000Z");
    expect(isInThisWeek("not-a-date", now)).toBe(false);
  });
});
