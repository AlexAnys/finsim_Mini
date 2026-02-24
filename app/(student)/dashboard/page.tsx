"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Timeline } from "@/components/dashboard/timeline";
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

interface DashboardData {
  courses: Array<{
    id: string;
    courseTitle: string;
    class: { id: string; name: string };
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentSubmissions: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  announcements: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduleSlots: Array<Record<string, any>>;
}

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

  const timelineItems = transformToTimeline(data);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>
      <Timeline items={timelineItems} role="student" />
    </div>
  );
}
