"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { TeacherGreetingHeader } from "@/components/teacher-dashboard/greeting-header";
import { KpiStrip } from "@/components/teacher-dashboard/kpi-strip";
import { AttentionList } from "@/components/teacher-dashboard/attention-list";
import { PerformanceChart } from "@/components/teacher-dashboard/performance-chart";
import { WeakInstances } from "@/components/teacher-dashboard/weak-instances";
import { TodaySchedule } from "@/components/teacher-dashboard/today-schedule";
import { ActivityFeed } from "@/components/teacher-dashboard/activity-feed";
import {
  buildActivityFeed,
  buildClassPerformance,
  buildCourseClassPerformance,
  buildCourseClassWeeklyTrend,
  buildCourseFilterOptions,
  buildDateLine,
  buildKpiSummary,
  buildPerformanceCourseOptions,
  buildTaskTimelineItems,
  buildUpcomingSchedule,
  buildWeakInstances,
  buildWeeklyTrend,
  startOfWeek,
  type TaskTimelineFilters,
} from "@/lib/utils/teacher-dashboard-transforms";
import { getCurrentWeekNumber } from "@/lib/utils/schedule-dates";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DashboardData {
  courses: Array<Record<string, any>>;
  taskInstances: Array<Record<string, any>>;
  recentSubmissions: Array<Record<string, any>>;
  announcements: Array<Record<string, any>>;
  scheduleSlots: Array<Record<string, any>>;
  stats: {
    submittedCount: number;
    gradedCount: number;
    pendingCount: number;
    draftCount: number;
    publishedCount: number;
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function currentWeekLabel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduleSlots: Array<Record<string, any>>,
  now: Date = new Date(),
): string | null {
  let earliest: Date | null = null;
  for (const s of scheduleSlots) {
    const raw = s.course?.semesterStartDate;
    if (!raw) continue;
    const d = new Date(raw);
    if (!earliest || d < earliest) earliest = d;
  }
  if (!earliest) return null;
  const week = getCurrentWeekNumber(earliest, now);
  if (week <= 0) return null;
  return `第 ${week} 教学周`;
}

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/lms/dashboard/summary");
        const json = await res.json();
        if (aborted) return;
        if (!json.success) {
          setError(json.error?.message || "加载失败");
          return;
        }
        setData(json.data);
      } catch {
        if (!aborted) setError("网络错误，请稍后重试");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    fetchDashboard();
    return () => {
      aborted = true;
    };
  }, []);

  const kpi = useMemo(() => {
    if (!data)
      return {
        classCount: 0,
        studentCount: 0,
        submittedThisWeek: 0,
        submittedDelta: null as number | null,
        completionRate: null as number | null,
        pendingCount: 0,
        pendingHint: null as string | null,
        avgScore: null as number | null,
        avgScoreDelta: null as number | null,
        weakInstanceCount: 0,
      };
    const summary = buildKpiSummary({
      courses: data.courses,
      taskInstances: data.taskInstances,
      recentSubmissions: data.recentSubmissions,
      statsPendingCount: data.stats.pendingCount,
    });
    return {
      ...summary,
      submittedDelta: null,
      pendingHint:
        summary.pendingCount > 0 ? "前往任务列表批改" : null,
    };
  }, [data]);

  const [taskFilters, setTaskFilters] = useState<TaskTimelineFilters>({
    courseId: null,
    taskType: null,
  });

  const courseFilterOptions = useMemo(
    () => (data ? buildCourseFilterOptions(data.taskInstances) : []),
    [data],
  );

  const taskTimelineItems = useMemo(
    () =>
      data ? buildTaskTimelineItems(data.taskInstances, taskFilters) : [],
    [data, taskFilters],
  );

  const weakInstances = useMemo(
    () => (data ? buildWeakInstances(data.taskInstances, 3) : []),
    [data],
  );

  const classPerf = useMemo(
    () => (data ? buildClassPerformance(data.taskInstances) : []),
    [data],
  );

  const weeklyTrend = useMemo(
    () => (data ? buildWeeklyTrend(data.recentSubmissions) : []),
    [data],
  );

  // B7 · 班级表现 filter（按课程对比班级）
  const [performanceCourseId, setPerformanceCourseId] = useState<string | null>(
    null,
  );

  const performanceCourseOptions = useMemo(
    () => (data ? buildPerformanceCourseOptions(data.taskInstances) : []),
    [data],
  );

  const courseClasses = useMemo(
    () =>
      data && performanceCourseId
        ? buildCourseClassPerformance(data.taskInstances, performanceCourseId)
        : [],
    [data, performanceCourseId],
  );

  const courseClassWeekly = useMemo(
    () =>
      data && performanceCourseId
        ? buildCourseClassWeeklyTrend(
            data.taskInstances,
            data.recentSubmissions,
            performanceCourseId,
          )
        : [],
    [data, performanceCourseId],
  );

  const upcomingSlots = useMemo(
    () => (data ? buildUpcomingSchedule(data.scheduleSlots, 4) : []),
    [data],
  );

  const activityItems = useMemo(
    () => (data ? buildActivityFeed(data.recentSubmissions, 4) : []),
    [data],
  );

  const publishedThisWeek = useMemo(() => {
    if (!data) return 0;
    const weekStartMs = startOfWeek(new Date()).getTime();
    return data.taskInstances.filter((ti) => {
      if (ti.status !== "published") return false;
      const ts = ti.publishedAt
        ? new Date(ti.publishedAt).getTime()
        : ti.createdAt
          ? new Date(ti.createdAt).getTime()
          : 0;
      return ts >= weekStartMs;
    }).length;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink-5" />
        <span className="ml-2 text-sm text-ink-4">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <AlertCircle className="size-8 text-danger" />
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const now = new Date();
  const weekLabel = currentWeekLabel(data.scheduleSlots, now);
  const dateLine = weekLabel
    ? `${buildDateLine(now)} · ${weekLabel}`
    : buildDateLine(now);
  const todayClassCount = upcomingSlots.filter((s) => s.isToday).length;

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <TeacherGreetingHeader
        dateLine={dateLine}
        todayClassCount={todayClassCount}
        pendingGradeCount={kpi.pendingCount}
        publishedThisWeek={publishedThisWeek}
      />

      <KpiStrip data={kpi} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <AttentionList
            items={taskTimelineItems}
            courseOptions={courseFilterOptions}
            filters={taskFilters}
            onFiltersChange={setTaskFilters}
          />
          <PerformanceChart
            overallAvg={kpi.avgScore}
            overallDelta={kpi.avgScoreDelta}
            classes={classPerf}
            weeklyTrend={weeklyTrend}
            courseOptions={performanceCourseOptions}
            courseClasses={courseClasses}
            courseClassWeekly={courseClassWeekly}
            selectedCourseId={performanceCourseId}
            onCourseChange={setPerformanceCourseId}
          />
          <WeakInstances items={weakInstances} />
        </div>

        <div className="flex flex-col gap-5">
          <TodaySchedule slots={upcomingSlots} />
          <ActivityFeed items={activityItems} />
        </div>
      </div>
    </div>
  );
}
