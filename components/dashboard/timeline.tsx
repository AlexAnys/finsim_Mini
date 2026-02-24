"use client";

import { useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { TaskCard } from "@/components/dashboard/task-card";
import { AnnouncementCard } from "@/components/dashboard/announcement-card";
import { ScheduleCard } from "@/components/dashboard/schedule-card";
import { CalendarDays } from "lucide-react";

interface TimelineItem {
  id: string;
  type: "task" | "announcement" | "schedule";
  date: string;
  courseName: string;
  courseId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export type TimelineFilter = "all" | "simulation" | "quiz" | "subjective" | "announcement";

interface TimelineProps {
  items: TimelineItem[];
  role: "student" | "teacher";
  filter?: TimelineFilter;
}

// Consistent color palette for courses
const COURSE_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
];

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = DAY_NAMES[date.getDay()];
  return `${month}月${day}日 ${weekday}`;
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DateStatus = "past" | "today" | "future";

function getDateStatus(dateKey: string): DateStatus {
  const todayKey = getTodayKey();
  if (dateKey === todayKey) return "today";
  return dateKey < todayKey ? "past" : "future";
}

export function Timeline({ items, role, filter = "all" }: TimelineProps) {
  const todayRef = useRef<HTMLDivElement>(null);

  // Build course color map
  const courseColorMap = useMemo(() => {
    const map = new Map<string, (typeof COURSE_COLORS)[number]>();
    const uniqueCourses = [...new Set(items.map((i) => i.courseName).filter(Boolean))];
    uniqueCourses.forEach((name, idx) => {
      map.set(name, COURSE_COLORS[idx % COURSE_COLORS.length]);
    });
    return map;
  }, [items]);

  // Filter + group items by date
  const groupedItems = useMemo(() => {
    const filtered = filter === "all"
      ? items
      : items.filter((item) => {
          if (filter === "announcement") return item.type === "announcement";
          if (item.type !== "task") return false;
          const taskType = item.data?.task?.taskType || item.data?.taskType || "";
          return taskType === filter;
        });

    const groups = new Map<string, { dateStr: string; items: TimelineItem[] }>();
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const item of sorted) {
      const key = getDateKey(item.date);
      if (!groups.has(key)) {
        groups.set(key, { dateStr: item.date, items: [] });
      }
      groups.get(key)!.items.push(item);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items, filter]);

  // Auto-scroll to today on mount
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [groupedItems]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <CalendarDays className="size-12 mb-3 opacity-40" />
        <p className="text-sm">暂无任务或公告</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[105px] top-0 bottom-0 w-px bg-border hidden sm:block" />

      <div className="space-y-6">
        {groupedItems.map(([dateKey, group]) => {
          const status = getDateStatus(dateKey);
          const isToday = status === "today";
          const isPast = status === "past";

          return (
            <div
              key={dateKey}
              ref={isToday ? todayRef : undefined}
              className="relative"
            >
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`shrink-0 w-[90px] text-right text-sm font-medium ${
                    isToday
                      ? "text-blue-600"
                      : isPast
                        ? "text-muted-foreground"
                        : "text-foreground"
                  }`}
                >
                  {isToday ? "今天" : formatDateGroup(group.dateStr)}
                </div>

                {/* Timeline dot */}
                <div className="relative z-10 hidden sm:flex">
                  <div
                    className={`size-3 rounded-full border-2 ${
                      isToday
                        ? "border-blue-500 bg-blue-500"
                        : isPast
                          ? "border-muted-foreground/40 bg-muted"
                          : "border-border bg-background"
                    }`}
                  />
                </div>

                {isToday && (
                  <Badge className="bg-blue-500 text-white text-[10px] px-2 py-0">
                    {formatDateGroup(group.dateStr)}
                  </Badge>
                )}
              </div>

              {/* Items — grouped by course */}
              <div className="sm:ml-[118px] space-y-2">
                {(() => {
                  // Sub-group consecutive items by courseName
                  const courseGroups: { courseName: string; items: typeof group.items }[] = [];
                  for (const item of group.items) {
                    const last = courseGroups[courseGroups.length - 1];
                    if (last && last.courseName === item.courseName) {
                      last.items.push(item);
                    } else {
                      courseGroups.push({ courseName: item.courseName, items: [item] });
                    }
                  }

                  return courseGroups.map((cg, cgIdx) => {
                    const color = courseColorMap.get(cg.courseName);

                    return (
                      <div key={`cg-${cgIdx}`} className="flex items-start gap-2">
                        {/* Left: course badge — once per group */}
                        <div className="shrink-0 w-[100px] mt-2">
                          {cg.courseName && color && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 max-w-[100px] truncate ${color.bg} ${color.text} ${color.border}`}
                            >
                              {cg.courseName}
                            </Badge>
                          )}
                        </div>

                        {/* Cards stacked */}
                        <div className={`flex-1 min-w-0 space-y-1.5 ${isPast ? "opacity-60" : ""}`}>
                          {cg.items.map((item) => (
                            <div key={`${item.type}-${item.id}`}>
                              {item.type === "schedule" ? (
                                <ScheduleCard slot={item.data} />
                              ) : item.type === "task" ? (
                                <TaskCard task={item.data} role={role} />
                              ) : (
                                <AnnouncementCard announcement={item.data} role={role} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
