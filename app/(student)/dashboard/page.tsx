"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, AlertCircle, CalendarDays, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timeline, type TimelineFilter } from "@/components/dashboard/timeline";
import { getCurrentWeekNumber, isSlotActiveForWeek } from "@/lib/utils/schedule-dates";

interface TimelineItem {
  id: string;
  type: "task" | "announcement" | "schedule";
  date: string;
  courseName: string;
  courseId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DashboardData {
  courses: Array<{
    id: string;
    courseTitle: string;
    class: { id: string; name: string };
  }>;
  tasks: Array<Record<string, any>>;
  recentSubmissions: Array<Record<string, any>>;
  announcements: Array<Record<string, any>>;
  scheduleSlots: Array<Record<string, any>>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function transformToTimeline(data: DashboardData): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Transform tasks
  for (const task of data.tasks || []) {
    items.push({
      id: task.id,
      type: "task",
      date: task.dueAt || task.createdAt,
      courseName: task.course?.courseTitle || "",
      courseId: task.course?.id,
      data: task,
    });
  }

  // Transform announcements
  for (const ann of data.announcements || []) {
    items.push({
      id: ann.id,
      type: "announcement",
      date: ann.createdAt,
      courseName: ann.course?.courseTitle || "",
      data: ann,
    });
  }

  // Transform today's schedule slots
  const now = new Date();
  const jsDay = now.getDay();
  const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;

  for (const slot of data.scheduleSlots || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = slot as Record<string, any>;
    if (s.dayOfWeek !== todayDayOfWeek) continue;

    const semesterStart = s.course?.semesterStartDate
      ? new Date(s.course.semesterStartDate)
      : null;
    const weekNumber = semesterStart ? getCurrentWeekNumber(semesterStart) : 0;
    const weekType = (s.weekType || "all") as "all" | "odd" | "even";

    if (weekNumber > 0 && !isSlotActiveForWeek(weekNumber, s.startWeek, s.endWeek, weekType)) {
      continue;
    }

    items.push({
      id: `schedule-${s.id}`,
      type: "schedule",
      date: now.toISOString(),
      courseName: s.course?.courseTitle || "",
      data: {
        id: s.id,
        courseName: s.course?.courseTitle || "",
        timeLabel: s.timeLabel,
        classroom: s.classroom,
        weekNumber: weekNumber || 1,
        weekType,
      },
    });
  }

  return items;
}

export default function StudentDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const timelineItems = useMemo(() => (data ? transformToTimeline(data) : []), [data]);

  const filterCounts = useMemo(() => {
    const counts = { all: 0, simulation: 0, quiz: 0, subjective: 0, announcement: 0 };
    for (const item of timelineItems) {
      counts.all++;
      if (item.type === "announcement") {
        counts.announcement++;
      } else if (item.type === "task") {
        const tt = item.data?.task?.taskType || item.data?.taskType || "";
        if (tt === "simulation") counts.simulation++;
        else if (tt === "quiz") counts.quiz++;
        else if (tt === "subjective") counts.subjective++;
      }
    }
    return counts;
  }, [timelineItems]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/lms/dashboard/summary");
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || "加载失败");
          return;
        }
        setData(json.data);
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

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

  if (!data) return null;

  // Get today's day of week (1=Monday ... 7=Sunday)
  const now = new Date();
  const jsDay = now.getDay();
  const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
  const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  const todaySlots = (data.scheduleSlots || [])
    .filter((s) => s.dayOfWeek === todayDayOfWeek)
    .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      {/* Today's classes - compact one-line format */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" />
            今日课程（{dayLabels[todayDayOfWeek - 1]}）
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {todaySlots.length > 0 ? (
            <div className="space-y-1">
              {todaySlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  <Clock className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {slot.course?.courseTitle || "未知课程"}
                    <span className="text-muted-foreground">
                      {" · "}{slot.timeLabel}
                      {slot.classroom && <>{" · "}{slot.classroom}</>}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-1">今日无课程</p>
          )}
        </CardContent>
      </Card>

      {/* Sticky filter tabs */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b -mx-1 px-1">
        <div className="flex items-center gap-1 pb-2 pt-2 overflow-x-auto">
          {(
            [
              { key: "all", label: "全部" },
              { key: "simulation", label: "模拟对话" },
              { key: "quiz", label: "测验" },
              { key: "subjective", label: "主观题" },
              { key: "announcement", label: "公告" },
            ] as { key: TimelineFilter; label: string }[]
          ).map(({ key, label }) => {
            const count = filterCounts[key];
            const isActive = filter === key;
            return (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(key)}
                className={`h-8 px-3 text-sm gap-1.5 ${
                  isActive
                    ? "bg-muted font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {label}
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 min-w-[18px] justify-center ${
                      isActive ? "" : "opacity-60"
                    }`}
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <Timeline items={timelineItems} role="student" filter={filter} />
    </div>
  );
}
