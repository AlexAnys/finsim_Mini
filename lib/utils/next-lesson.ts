import {
  getCurrentWeekNumber,
  isSlotActiveForWeek,
} from "@/lib/utils/schedule-dates";

export interface NextLessonSlot {
  id: string;
  courseId: string;
  course?: {
    id?: string;
    courseTitle?: string;
    semesterStartDate?: string | null;
  };
  dayOfWeek: number;
  timeLabel: string;
  classroom?: string | null;
  startWeek: number;
  endWeek: number;
  weekType?: "all" | "odd" | "even";
}

export interface NextLessonResult {
  title: string;
  date: string;
  classroom: string | null;
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function deriveNextLesson(
  courseId: string,
  slots: NextLessonSlot[],
  now: Date = new Date(),
): NextLessonResult | null {
  const courseSlots = slots.filter(
    (s) => (s.course?.id ?? s.courseId) === courseId,
  );
  if (courseSlots.length === 0) return null;

  const jsDay = now.getDay();
  const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let best:
    | { slot: NextLessonSlot; minutesFromNow: number; nextWeek: boolean }
    | null = null;

  for (const s of courseSlots) {
    const semesterStart = s.course?.semesterStartDate
      ? new Date(s.course.semesterStartDate)
      : null;
    const weekNumber = semesterStart
      ? getCurrentWeekNumber(semesterStart, now)
      : 0;
    const weekType = (s.weekType ?? "all") as "all" | "odd" | "even";
    if (
      weekNumber > 0 &&
      !isSlotActiveForWeek(weekNumber, s.startWeek, s.endWeek, weekType)
    ) {
      continue;
    }

    const timeMatch = s.timeLabel?.match(/(\d{1,2}):(\d{2})/);
    const slotStartMin = timeMatch
      ? Number(timeMatch[1]) * 60 + Number(timeMatch[2])
      : 8 * 60;

    let daysAhead = s.dayOfWeek - todayDayOfWeek;
    let nextWeek = false;
    if (
      daysAhead < 0 ||
      (daysAhead === 0 && slotStartMin < currentMinutes)
    ) {
      daysAhead += 7;
      nextWeek = true;
    }
    const minutesFromNow =
      daysAhead * 24 * 60 + (slotStartMin - currentMinutes);

    if (!best || minutesFromNow < best.minutesFromNow) {
      best = { slot: s, minutesFromNow, nextWeek };
    }
  }

  if (!best) return null;
  const { slot, minutesFromNow, nextWeek } = best;

  const daysAhead = Math.floor(minutesFromNow / (24 * 60));
  const targetIdx = slot.dayOfWeek - 1; // dayOfWeek 1..7 → index 0..6
  let dayLabel: string;
  if (!nextWeek && daysAhead === 0) dayLabel = "今天";
  else if (!nextWeek && daysAhead === 1) dayLabel = "明天";
  else if (!nextWeek) {
    dayLabel = WEEKDAY_LABELS[targetIdx];
  } else {
    dayLabel = `下${WEEKDAY_LABELS[targetIdx]}`;
  }

  return {
    title: slot.course?.courseTitle ?? "课程",
    date: `${dayLabel} ${slot.timeLabel}`,
    classroom: slot.classroom ?? null,
  };
}
