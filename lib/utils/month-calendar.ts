import {
  getScheduleDatesForWeek,
  isSlotActiveForWeek,
  getCurrentWeekNumber,
} from "./schedule-dates";

export interface MonthSlot {
  id: string;
  courseId: string;
  dayOfWeek: number;
  slotIndex: number;
  startWeek: number;
  endWeek: number;
  timeLabel: string;
  classroom: string | null;
  weekType: string;
  course: { courseTitle: string; semesterStartDate: string | null };
}

export interface MonthTask {
  id: string;
  title?: string;
  dueAt: string;
  course?: { id: string; courseTitle: string } | null;
  task?: { taskName: string } | null;
}

export interface MonthAnnouncement {
  id: string;
  title: string;
  createdAt: string;
  course?: { courseTitle: string } | null;
}

export interface DaySlotOccurrence {
  slotId: string;
  courseId: string;
  courseTitle: string;
  slotIndex: number;
  timeLabel: string;
  classroom: string | null;
}

export interface CalendarDay {
  date: Date;
  key: string; // yyyy-mm-dd
  inMonth: boolean;
  isToday: boolean;
  slots: DaySlotOccurrence[];
  tasks: MonthTask[];
  announcements: MonthAnnouncement[];
}

/**
 * Builds a 6-row × 7-col month grid starting on Monday. Pads leading days with
 * the previous month's tail and trailing days with the next month's head.
 * Returns 42 cells.
 */
export function buildMonthGrid(year: number, month0: number, now: Date = new Date()): CalendarDay[] {
  const first = new Date(year, month0, 1);
  const jsDay = first.getDay(); // 0=Sun ... 6=Sat
  const leading = jsDay === 0 ? 6 : jsDay - 1; // days before the first to fill
  const start = new Date(year, month0, 1 - leading);

  const todayKey = dateKey(now);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({
      date: d,
      key: dateKey(d),
      inMonth: d.getMonth() === month0,
      isToday: dateKey(d) === todayKey,
      slots: [],
      tasks: [],
      announcements: [],
    });
  }
  return days;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * For every slot with a semesterStartDate, compute the set of actual calendar
 * dates (Date objects) it hits and attach occurrences to the matching day cell.
 * Slots with no semesterStartDate or dates outside the grid range are skipped.
 */
export function expandSlotsToDays(
  slots: MonthSlot[],
  grid: CalendarDay[]
): void {
  if (grid.length === 0) return;
  const byKey = new Map(grid.map((d) => [d.key, d]));
  const gridStart = grid[0].date;
  const gridEnd = grid[grid.length - 1].date;

  for (const s of slots) {
    if (!s.course?.semesterStartDate) continue;
    const semesterStart = new Date(s.course.semesterStartDate);
    // Compute only weeks that could overlap the grid window to keep the loop
    // small (vs. iterating all startWeek..endWeek blindly).
    const dayOfWeek = s.dayOfWeek;
    const weekType = (s.weekType || "all") as "all" | "odd" | "even";
    // Derive the week number of gridStart and gridEnd relative to semesterStart
    const wStart = Math.max(
      s.startWeek,
      getCurrentWeekNumber(semesterStart, gridStart) || 1
    );
    const wEnd = Math.min(
      s.endWeek,
      Math.max(getCurrentWeekNumber(semesterStart, gridEnd), 1)
    );
    for (let week = wStart; week <= wEnd; week++) {
      if (!isSlotActiveForWeek(week, s.startWeek, s.endWeek, weekType)) continue;
      const weekStartDate = new Date(semesterStart);
      weekStartDate.setDate(
        weekStartDate.getDate() + (week - 1) * 7 + (dayOfWeek - 1)
      );
      const key = dateKey(weekStartDate);
      const cell = byKey.get(key);
      if (!cell) continue;
      cell.slots.push({
        slotId: s.id,
        courseId: s.courseId,
        courseTitle: s.course.courseTitle,
        slotIndex: s.slotIndex,
        timeLabel: s.timeLabel,
        classroom: s.classroom,
      });
    }
  }

  // Sort each cell's slots by slotIndex
  for (const cell of grid) {
    cell.slots.sort((a, b) => a.slotIndex - b.slotIndex);
  }
}

export function attachTasksAndAnnouncements(
  tasks: MonthTask[],
  announcements: MonthAnnouncement[],
  grid: CalendarDay[]
): void {
  const byKey = new Map(grid.map((d) => [d.key, d]));
  for (const t of tasks) {
    if (!t.dueAt) continue;
    const d = new Date(t.dueAt);
    if (isNaN(d.getTime())) continue;
    const cell = byKey.get(dateKey(d));
    if (cell) cell.tasks.push(t);
  }
  for (const a of announcements) {
    if (!a.createdAt) continue;
    const d = new Date(a.createdAt);
    if (isNaN(d.getTime())) continue;
    const cell = byKey.get(dateKey(d));
    if (cell) cell.announcements.push(a);
  }
}

// Re-export for convenience
export { getScheduleDatesForWeek };
