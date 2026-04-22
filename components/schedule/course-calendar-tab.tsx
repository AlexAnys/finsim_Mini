"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Megaphone,
} from "lucide-react";
import { getCourseColor } from "@/lib/utils/calendar-colors";
import {
  buildMonthGrid,
  expandSlotsToDays,
  attachTasksAndAnnouncements,
  type MonthSlot,
  type MonthTask,
  type MonthAnnouncement,
  type CalendarDay,
} from "@/lib/utils/month-calendar";

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

interface CourseCalendarTabProps {
  role: "teacher" | "student";
}

export function CourseCalendarTab({ role }: CourseCalendarTabProps) {
  const [slots, setSlots] = useState<MonthSlot[]>([]);
  const [tasks, setTasks] = useState<MonthTask[]>([]);
  const [announcements, setAnnouncements] = useState<MonthAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [slotsRes, tasksRes, annRes] = await Promise.all([
          fetch("/api/lms/schedule-slots"),
          fetch("/api/lms/task-instances"),
          fetch("/api/lms/announcements"),
        ]);
        const [slotsJson, tasksJson, annJson] = await Promise.all([
          slotsRes.json(),
          tasksRes.json(),
          annRes.json(),
        ]);
        if (cancelled) return;
        if (slotsJson.success) setSlots(slotsJson.data || []);
        else throw new Error(slotsJson.error?.message || "加载课表失败");
        if (tasksJson.success) setTasks(tasksJson.data || []);
        if (annJson.success) setAnnouncements(annJson.data || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grid: CalendarDay[] = useMemo(() => {
    const g = buildMonthGrid(cursor.getFullYear(), cursor.getMonth(), today);
    expandSlotsToDays(slots, g);
    attachTasksAndAnnouncements(tasks, announcements, g);
    return g;
  }, [cursor, slots, tasks, announcements, today]);

  // Mobile: only in-month days that have content, sorted by date
  const mobileDays = useMemo(
    () =>
      grid.filter(
        (d) =>
          d.inMonth &&
          (d.slots.length > 0 || d.tasks.length > 0 || d.announcements.length > 0)
      ),
    [grid]
  );

  function prevMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }
  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const monthLabel = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-5" />
            {monthLabel}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={goToday}
            >
              今天
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop: 7×6 grid */}
        <div className="hidden sm:grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="bg-muted text-muted-foreground text-xs font-medium text-center py-1.5"
            >
              {d}
            </div>
          ))}
          {grid.map((day) => (
            <DayCell key={day.key} day={day} role={role} />
          ))}
        </div>

        {/* Mobile: per-day list (only in-month days with content) */}
        <div className="sm:hidden space-y-3">
          {mobileDays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <CalendarDays className="size-8" />
              <p className="mt-2 text-sm">本月暂无课程</p>
            </div>
          ) : (
            mobileDays.map((day) => (
              <div
                key={day.key}
                className={`rounded-md border p-3 ${
                  day.isToday ? "ring-2 ring-primary" : ""
                }`}
              >
                <DayDetail day={day} role={role} />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DayCellProps {
  day: CalendarDay;
  role: "teacher" | "student";
}

function DayCell({ day, role }: DayCellProps) {
  const hasContent =
    day.slots.length > 0 ||
    day.tasks.length > 0 ||
    day.announcements.length > 0;

  const visibleSlots = day.slots.slice(0, 2);
  const extraSlots = day.slots.length - visibleSlots.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`bg-background min-h-[80px] sm:min-h-[92px] p-1 text-left transition-colors ${
            day.inMonth ? "" : "opacity-40"
          } ${hasContent ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
          disabled={!hasContent}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs ${
                day.isToday
                  ? "bg-primary text-primary-foreground rounded-full size-5 inline-flex items-center justify-center"
                  : "text-muted-foreground"
              }`}
            >
              {day.date.getDate()}
            </span>
            <div className="flex items-center gap-0.5">
              {day.tasks.length > 0 && (
                <AlertCircle className="size-3 text-amber-600" />
              )}
              {day.announcements.length > 0 && (
                <span className="size-1.5 rounded-full bg-blue-500" />
              )}
            </div>
          </div>
          <div className="space-y-0.5 mt-1">
            {visibleSlots.map((s) => {
              const color = getCourseColor(s.courseId);
              return (
                <div
                  key={s.slotId}
                  className="truncate text-[10px] leading-tight px-1 py-0.5 rounded border"
                  style={color}
                  title={`${s.courseTitle} · 第${s.slotIndex}节 ${s.timeLabel}`}
                >
                  {s.courseTitle}
                </div>
              );
            })}
            {extraSlots > 0 && (
              <div className="text-[10px] text-muted-foreground px-1">
                +{extraSlots} 更多
              </div>
            )}
          </div>
        </button>
      </PopoverTrigger>
      {hasContent && (
        <PopoverContent align="start" className="w-80 p-3">
          <DayDetail day={day} role={role} />
        </PopoverContent>
      )}
    </Popover>
  );
}

function DayDetail({ day, role }: { day: CalendarDay; role: "teacher" | "student" }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">
        {day.date.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        })}
      </div>

      {day.slots.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            课程
          </div>
          {day.slots.map((s) => {
            const color = getCourseColor(s.courseId);
            return (
              <div
                key={s.slotId}
                className="flex items-start gap-2 rounded-md border p-2"
                style={{ borderColor: color.borderColor }}
              >
                <span
                  className="size-2.5 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: color.backgroundColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.courseTitle}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    第{s.slotIndex}节 · {s.timeLabel}
                    {s.classroom && <> · {s.classroom}</>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {day.tasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="size-3" />
            任务截止
          </div>
          {day.tasks.map((t) => {
            const href =
              role === "teacher" ? `/teacher/instances/${t.id}` : `/tasks/${t.id}`;
            return (
              <Link
                key={t.id}
                href={href}
                className="flex items-start gap-2 rounded-md border p-2 hover:bg-muted/50"
              >
                <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {t.title || t.task?.taskName || "未命名任务"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.course?.courseTitle && <>{t.course.courseTitle} · </>}
                    {new Date(t.dueAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {day.announcements.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Megaphone className="size-3" />
            公告
          </div>
          {day.announcements.map((a) => (
            <div key={a.id} className="flex items-start gap-2 rounded-md border p-2">
              <Megaphone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.title}</div>
                {a.course?.courseTitle && (
                  <div className="text-xs text-muted-foreground truncate">
                    {a.course.courseTitle}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
