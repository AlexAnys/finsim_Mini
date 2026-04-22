/**
 * Get the current teaching week number based on semester start date.
 * Returns 0 if semester hasn't started yet.
 */
export function getCurrentWeekNumber(semesterStart: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - semesterStart.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Get the start (Monday) and end (Sunday) dates for a specific week.
 */
export function getWeekDates(semesterStart: Date, weekNumber: number): { start: Date; end: Date } {
  const start = new Date(semesterStart);
  start.setDate(start.getDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Check if a schedule slot should be active for a given week number.
 */
export function isSlotActiveForWeek(
  weekNumber: number,
  startWeek: number,
  endWeek: number,
  weekType: "all" | "odd" | "even"
): boolean {
  if (weekNumber < startWeek || weekNumber > endWeek) return false;
  if (weekType === "odd") return weekNumber % 2 === 1;
  if (weekType === "even") return weekNumber % 2 === 0;
  return true;
}

/**
 * Get actual dates for a schedule slot across the semester.
 */
export function getScheduleDatesForWeek(
  semesterStart: Date,
  dayOfWeek: number,
  startWeek: number,
  endWeek: number,
  weekType: "all" | "odd" | "even"
): Date[] {
  const dates: Date[] = [];
  for (let week = startWeek; week <= endWeek; week++) {
    if (!isSlotActiveForWeek(week, startWeek, endWeek, weekType)) continue;
    const weekStart = new Date(semesterStart);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
    const date = new Date(weekStart);
    date.setDate(date.getDate() + (dayOfWeek - 1));
    dates.push(date);
  }
  return dates;
}
