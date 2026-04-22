import { getCurrentWeekNumber, isSlotActiveForWeek } from "./schedule-dates";

export interface ThisWeekSlot {
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

/**
 * 过滤出本周（按各课程的 semesterStartDate 计算）应当上课的时段。
 * - 无 semesterStartDate 的课程：跳过（不展示）
 * - weekNumber 必须在 [startWeek, endWeek] 内 + 符合 weekType
 */
export function filterThisWeekSlots<T extends ThisWeekSlot>(
  slots: T[],
  now: Date = new Date()
): T[] {
  return slots.filter((s) => {
    const start = s.course?.semesterStartDate
      ? new Date(s.course.semesterStartDate)
      : null;
    if (!start) return false;
    const weekNumber = getCurrentWeekNumber(start, now);
    if (weekNumber === 0) return false;
    const weekType = (s.weekType || "all") as "all" | "odd" | "even";
    return isSlotActiveForWeek(weekNumber, s.startWeek, s.endWeek, weekType);
  });
}

/**
 * 获取本周一到周日的日期范围（基于"now"所在 ISO 周：周一起始）。
 */
export function getThisWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(now);
  const jsDay = d.getDay(); // 0=Sun ... 6=Sat
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const start = new Date(d);
  start.setDate(d.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * 判断某 ISO 时间是否在本周范围内。
 */
export function isInThisWeek(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const { start, end } = getThisWeekRange(now);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}
