import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  dateKey,
  expandSlotsToDays,
  attachTasksAndAnnouncements,
  type MonthSlot,
  type MonthTask,
  type MonthAnnouncement,
} from "@/lib/utils/month-calendar";

function slot(
  id: string,
  opts: Partial<MonthSlot> & { semesterStartDate?: string | null }
): MonthSlot {
  return {
    id,
    courseId: opts.courseId ?? "c-1",
    dayOfWeek: opts.dayOfWeek ?? 1,
    slotIndex: opts.slotIndex ?? 1,
    startWeek: opts.startWeek ?? 1,
    endWeek: opts.endWeek ?? 16,
    timeLabel: opts.timeLabel ?? "08:30-10:05",
    classroom: opts.classroom ?? null,
    weekType: opts.weekType ?? "all",
    course: {
      courseTitle: opts.course?.courseTitle ?? "测试课程",
      semesterStartDate: opts.semesterStartDate ?? null,
    },
  };
}

describe("buildMonthGrid", () => {
  it("returns 42 cells (6 weeks × 7 days)", () => {
    const grid = buildMonthGrid(2026, 3, new Date("2026-04-22T00:00:00.000Z"));
    expect(grid).toHaveLength(42);
  });

  it("first row starts on Monday — April 2026 first Monday is March 30", () => {
    // April 1 2026 is a Wednesday, so grid[0] should be Monday March 30
    const grid = buildMonthGrid(2026, 3, new Date("2026-04-22T00:00:00.000Z"));
    expect(grid[0].date.getDate()).toBe(30);
    expect(grid[0].date.getMonth()).toBe(2); // March
    expect(grid[0].inMonth).toBe(false);
  });

  it("marks today when today falls in the visible month", () => {
    const today = new Date(2026, 3, 22, 10, 0, 0); // April 22 local
    const grid = buildMonthGrid(2026, 3, today);
    const todayCell = grid.find((d) => d.isToday);
    expect(todayCell?.date.getDate()).toBe(22);
  });

  it("does not mark today when it's outside the visible month", () => {
    const today = new Date(2026, 3, 22, 10, 0, 0);
    const grid = buildMonthGrid(2026, 0, today); // January
    expect(grid.every((d) => !d.isToday)).toBe(true);
  });

  it("inMonth is true only for cells whose month matches month0", () => {
    const grid = buildMonthGrid(2026, 3, new Date("2026-04-22T00:00:00.000Z"));
    for (const d of grid) {
      expect(d.inMonth).toBe(d.date.getMonth() === 3);
    }
  });
});

describe("dateKey", () => {
  it("formats as yyyy-mm-dd zero-padded", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("expandSlotsToDays", () => {
  it("skips slots without semesterStartDate", () => {
    const grid = buildMonthGrid(2026, 3, new Date("2026-04-22T00:00:00.000Z"));
    expandSlotsToDays([slot("s1", { semesterStartDate: null })], grid);
    expect(grid.every((d) => d.slots.length === 0)).toBe(true);
  });

  it("places a weekly Monday slot on every visible Monday — including grid leading/trailing cells", () => {
    // Semester starts Monday 2026-02-16 (local week 1). April 2026 grid spans
    // Mon Mar 30 (leading, week 7) through Sun May 10 (trailing).
    // All 6 Mondays in view at weeks 7..12 (within startWeek=1..endWeek=16):
    // 3/30, 4/6, 4/13, 4/20, 4/27, 5/4
    const grid = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 0, 0, 0));
    expandSlotsToDays(
      [
        slot("s1", {
          semesterStartDate: new Date(2026, 1, 16).toISOString(),
          dayOfWeek: 1,
          startWeek: 1,
          endWeek: 16,
          weekType: "all",
        }),
      ],
      grid
    );
    const hitDays = grid.filter((d) => d.slots.length > 0);
    expect(hitDays).toHaveLength(6);
    // All cells must be Mondays (dayOfWeek=1 → local getDay() = 1)
    for (const d of hitDays) {
      expect(d.date.getDay()).toBe(1);
    }
  });

  it("applies weekType=odd (only odd-numbered weeks)", () => {
    // semesterStart = 2026-02-16 local. Visible Mondays at weeks 7..12.
    // odd: 7 (Mar 30), 9 (Apr 13), 11 (Apr 27). Even ones are skipped.
    const grid = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 0, 0, 0));
    expandSlotsToDays(
      [
        slot("s1", {
          semesterStartDate: new Date(2026, 1, 16).toISOString(),
          dayOfWeek: 1,
          startWeek: 1,
          endWeek: 16,
          weekType: "odd",
        }),
      ],
      grid
    );
    const dates = grid
      .filter((d) => d.slots.length > 0)
      .map((d) => d.date.getDate())
      .sort((a, b) => a - b);
    expect(dates).toEqual([13, 27, 30]);
  });

  it("sorts multiple slots on same day by slotIndex", () => {
    const grid = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 0, 0, 0));
    expandSlotsToDays(
      [
        slot("s2", {
          semesterStartDate: new Date(2026, 1, 16).toISOString(),
          dayOfWeek: 1,
          slotIndex: 3,
        }),
        slot("s1", {
          semesterStartDate: new Date(2026, 1, 16).toISOString(),
          dayOfWeek: 1,
          slotIndex: 1,
        }),
      ],
      grid
    );
    const firstMonday = grid.find((d) => d.slots.length === 2);
    expect(firstMonday?.slots.map((s) => s.slotIndex)).toEqual([1, 3]);
  });

  it("honors startWeek/endWeek bounds — a slot active only weeks 5-7 has only the week-7 Monday hit", () => {
    // Semester starts 2026-02-16 local. Week 7 Monday = 2026-03-30 (in grid as leading cell).
    // Weeks 5,6 are March 16, March 23 — outside grid. Weeks 8+ excluded by endWeek=7.
    const grid = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 0, 0, 0));
    expandSlotsToDays(
      [
        slot("s1", {
          semesterStartDate: new Date(2026, 1, 16).toISOString(),
          dayOfWeek: 1,
          startWeek: 5,
          endWeek: 7,
        }),
      ],
      grid
    );
    const hits = grid.filter((d) => d.slots.length > 0);
    expect(hits.map((d) => d.date.getDate())).toEqual([30]);
    expect(hits[0].date.getMonth()).toBe(2); // March
  });
});

describe("attachTasksAndAnnouncements", () => {
  it("attaches task by local date of dueAt", () => {
    const fresh = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 10, 0, 0));
    const task: MonthTask = {
      id: "t-1",
      title: "测验",
      dueAt: new Date(2026, 3, 22, 23, 59).toISOString(),
    };
    attachTasksAndAnnouncements([task], [], fresh);
    const cell = fresh.find((d) => d.date.getDate() === 22 && d.date.getMonth() === 3);
    expect(cell?.tasks).toHaveLength(1);
    expect(cell?.tasks[0].id).toBe("t-1");
  });

  it("skips tasks with invalid or empty dueAt", () => {
    const fresh = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 10, 0, 0));
    attachTasksAndAnnouncements(
      [
        { id: "t-bad", title: "X", dueAt: "not-a-date" },
        { id: "t-empty", title: "Y", dueAt: "" },
      ],
      [],
      fresh
    );
    expect(fresh.every((d) => d.tasks.length === 0)).toBe(true);
  });

  it("attaches announcement by local date of createdAt", () => {
    const fresh = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 10, 0, 0));
    const ann: MonthAnnouncement = {
      id: "a-1",
      title: "公告",
      createdAt: new Date(2026, 3, 15, 10, 0).toISOString(),
    };
    attachTasksAndAnnouncements([], [ann], fresh);
    const cell = fresh.find((d) => d.date.getDate() === 15 && d.date.getMonth() === 3);
    expect(cell?.announcements).toHaveLength(1);
  });

  it("ignores tasks whose date is outside the grid window", () => {
    const fresh = buildMonthGrid(2026, 3, new Date(2026, 3, 22, 10, 0, 0));
    attachTasksAndAnnouncements(
      [{ id: "t-far", title: "Z", dueAt: new Date(2027, 5, 1).toISOString() }],
      [],
      fresh
    );
    expect(fresh.every((d) => d.tasks.length === 0)).toBe(true);
  });
});
