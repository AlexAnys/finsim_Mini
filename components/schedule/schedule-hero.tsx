"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { getCurrentWeekNumber } from "@/lib/utils/schedule-dates";
import { filterThisWeekSlots, type ThisWeekSlot } from "@/lib/utils/this-week-schedule";
import type { SemesterHeaderCourse } from "@/components/schedule/semester-header";

interface ScheduleHeroProps {
  /** 学期 chip 文案，形如"本学期 · 2026 春"。 */
  semesterLabel: string;
  /** 用于派生当前周的课程列表（取最早 semesterStartDate）。 */
  courses: SemesterHeaderCourse[];
  /** 用于派生"今天 N 节课"的本周 slots（已含 course.semesterStartDate）。 */
  slots: ThisWeekSlot[];
}

interface HeroMeta {
  weekNumber: number;
  weekType: "单周" | "双周";
  todayCount: number;
}

/**
 * 派生 hero 副标元数据。
 * - 第几周：取最早的 course.semesterStartDate 当锚（学生通常多课同学期）。
 * - 单/双周：weekNumber 奇偶。
 * - 今天 N 节课：本周内 dayOfWeek 等于今天的 slot 数。
 *
 * 边界：
 * - 没有任何 semesterStartDate 时返回 weekNumber=0 占位（UI 层提示）。
 * - weekNumber=0（学期未开始）也返回 0 让 UI 显示"未开始"。
 */
export function deriveHeroMeta(
  courses: SemesterHeaderCourse[],
  slots: ThisWeekSlot[],
  now: Date = new Date()
): HeroMeta {
  let earliest: Date | null = null;
  for (const c of courses) {
    if (!c.semesterStartDate) continue;
    const d = new Date(c.semesterStartDate);
    if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
  }
  const weekNumber = earliest ? getCurrentWeekNumber(earliest, now) : 0;
  const weekType: "单周" | "双周" = weekNumber % 2 === 1 ? "单周" : "双周";

  const jsDay = now.getDay();
  const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
  const thisWeekSlots = filterThisWeekSlots(slots, now);
  const todayCount = thisWeekSlots.filter((s) => s.dayOfWeek === todayDayOfWeek).length;

  return { weekNumber, weekType, todayCount };
}

export function buildHeroSubtitle(meta: HeroMeta): string {
  if (meta.weekNumber === 0) {
    return `学期未开始 · 今天 ${meta.todayCount} 节课`;
  }
  return `第 ${meta.weekNumber} 周 · ${meta.weekType} · 今天 ${meta.todayCount} 节课`;
}

export function ScheduleHero({ semesterLabel, courses, slots }: ScheduleHeroProps) {
  const meta = useMemo(() => deriveHeroMeta(courses, slots), [courses, slots]);
  const subtitle = buildHeroSubtitle(meta);

  function handleExportICal() {
    toast.info("导出 iCal 功能即将上线");
  }

  function handleToggleMonth() {
    toast.info("月视图即将上线，目前请使用日历 Tab 查看月视图");
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
          {semesterLabel}
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-2 md:text-[28px]">
          课表
        </h1>
        <p className="mt-1 text-[13px] text-ink-4">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExportICal}>
          导出 iCal
        </Button>
        <Button variant="outline" size="sm" onClick={handleToggleMonth}>
          <CalendarDays className="size-3.5" />
          切换月视图
        </Button>
      </div>
    </div>
  );
}
