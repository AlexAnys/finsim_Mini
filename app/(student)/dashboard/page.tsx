"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2,
  AlertCircle,
  FileText,
  CheckCircle2,
  TrendingUp,
  Target,
} from "lucide-react";
import { GreetingHero } from "@/components/dashboard/greeting-hero";
import { KpiStatCard } from "@/components/dashboard/kpi-stat-card";
import { TodayClasses } from "@/components/dashboard/today-classes";
import {
  PriorityTasks,
  type PriorityTask,
} from "@/components/dashboard/priority-tasks";
import {
  RecentGrades,
  type RecentGradeItem,
} from "@/components/dashboard/recent-grades";
import {
  deriveAnalysisStatus,
  type SubmissionAnalysisStatus,
} from "@/components/instance-detail/submissions-utils";
import {
  CourseProgressSidebar,
  type CourseProgressItem,
} from "@/components/dashboard/course-progress-sidebar";
import {
  AnnouncementSummary,
  type AnnouncementSummaryItem,
} from "@/components/dashboard/announcement-summary";
import { AiBuddyCallout } from "@/components/dashboard/ai-buddy-callout";
import {
  getCurrentWeekNumber,
  isSlotActiveForWeek,
} from "@/lib/utils/schedule-dates";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DashboardData {
  courses: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
  recentSubmissions: Array<Record<string, any>>;
  announcements: Array<Record<string, any>>;
  scheduleSlots: Array<Record<string, any>>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function buildDateLine(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const jsDay = now.getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
  return `${y} 年 ${m} 月 ${d} 日 · ${WEEKDAY_LABELS[todayIdx]}`;
}

function currentWeekLabel(
  scheduleSlots: DashboardData["scheduleSlots"],
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isTaskPending(t: Record<string, any>): boolean {
  const status = t.studentStatus as string | undefined;
  return status === "todo" || status === "overdue";
}

export default function StudentDashboardPage() {
  const { data: session } = useSession();
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
        // 防御：API 偶发返回不完整字段时仍保证 5 数组（避免下游 useMemo crash）
        const raw = json.data ?? {};
        setData({
          courses: Array.isArray(raw.courses) ? raw.courses : [],
          tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
          recentSubmissions: Array.isArray(raw.recentSubmissions)
            ? raw.recentSubmissions
            : [],
          announcements: Array.isArray(raw.announcements) ? raw.announcements : [],
          scheduleSlots: Array.isArray(raw.scheduleSlots) ? raw.scheduleSlots : [],
        });
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

  const displayName = useMemo(() => {
    const raw = session?.user?.name?.trim();
    if (!raw) return "同学";
    return raw;
  }, [session]);

  const todaySlots = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const jsDay = now.getDay();
    const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    return data.scheduleSlots
      .filter((s) => s.dayOfWeek === todayDayOfWeek)
      .map((s) => {
        const semesterStart = s.course?.semesterStartDate
          ? new Date(s.course.semesterStartDate)
          : null;
        const weekNumber = semesterStart
          ? getCurrentWeekNumber(semesterStart)
          : 0;
        const weekType = (s.weekType || "all") as "all" | "odd" | "even";
        if (
          weekNumber > 0 &&
          !isSlotActiveForWeek(
            weekNumber,
            s.startWeek,
            s.endWeek,
            weekType,
          )
        ) {
          return null;
        }

        // Parse timeLabel like "08:00-09:40" for in-progress check
        let inProgress = false;
        if (typeof s.timeLabel === "string") {
          const match = s.timeLabel.match(
            /(\d{1,2}):(\d{2})[^\d]+(\d{1,2}):(\d{2})/,
          );
          if (match) {
            const [, sh, sm, eh, em] = match;
            const startMin = Number(sh) * 60 + Number(sm);
            const endMin = Number(eh) * 60 + Number(em);
            const nowMin = currentH * 60 + currentM;
            inProgress = nowMin >= startMin && nowMin < endMin;
          }
        }

        return {
          id: String(s.id),
          courseId: String(s.course?.id ?? s.courseId ?? ""),
          courseTitle: s.course?.courseTitle || "未知课程",
          timeLabel: s.timeLabel || "",
          classroom: s.classroom ?? null,
          teacherName: null,
          inProgress,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
  }, [data]);

  const priorityTasks = useMemo<PriorityTask[]>(() => {
    if (!data) return [];
    return data.tasks
      .filter(isTaskPending)
      .sort((a, b) => {
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return aDue - bDue;
      })
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        taskType: (t.task?.taskType ||
          t.taskType ||
          "subjective") as PriorityTask["taskType"],
        taskName: t.task?.taskName || t.taskName || "未命名任务",
        courseId: t.course?.id ?? null,
        courseTitle: t.course?.courseTitle || "",
        chapterTitle: t.chapter?.title ?? null,
        dueAt: t.dueAt ?? null,
        attemptsAllowed: t.attemptsAllowed ?? null,
        canSubmit: Boolean(t.canSubmit),
        questionCount: null,
      }));
  }, [data]);

  const recentGrades = useMemo<RecentGradeItem[]>(() => {
    if (!data) return [];
    // Build a map of tasks by id so we can enrich submission with task title/type
    const tasksById = new Map<string, Record<string, unknown>>();
    for (const t of data.tasks) {
      tasksById.set(t.id, t);
    }
    // PR-SIM-1c · D1 防作弊：保留 submitted/grading/graded（不仅 graded+score!=null），
    // 让 RecentGrades 卡片基于 analysisStatus chip 渲染未公布的状态
    return data.recentSubmissions
      .filter(
        (s) => s.status === "submitted" || s.status === "grading" || s.status === "graded",
      )
      .slice(0, 3)
      .map((s) => {
        const parent = s.taskInstanceId
          ? (tasksById.get(s.taskInstanceId) as Record<string, unknown> | undefined)
          : undefined;
        const taskObj = parent?.task as Record<string, unknown> | undefined;
        const analysisStatus: SubmissionAnalysisStatus =
          (s.analysisStatus as SubmissionAnalysisStatus | undefined) ??
          deriveAnalysisStatus({
            status: String(s.status),
            releasedAt: (s.releasedAt ?? null) as string | null,
          });
        return {
          id: String(s.id),
          taskName:
            (taskObj?.taskName as string | undefined) ||
            (parent?.taskName as string | undefined) ||
            "任务",
          taskType:
            (taskObj?.taskType as string | undefined) || "subjective",
          date: s.gradedAt || s.submittedAt,
          score: Number(s.score) || 0,
          maxScore: Number(s.maxScore) || 100,
          href: s.taskInstanceId ? `/tasks/${s.taskInstanceId}` : undefined,
          analysisStatus,
        };
      });
  }, [data]);

  const courseProgressItems = useMemo<CourseProgressItem[]>(() => {
    if (!data) return [];
    const tasksByCourse = new Map<string, { total: number; done: number }>();
    for (const t of data.tasks) {
      const cid = t.course?.id;
      if (!cid) continue;
      const bucket =
        tasksByCourse.get(cid) ?? { total: 0, done: 0 };
      bucket.total += 1;
      if (t.studentStatus === "graded" || t.studentStatus === "submitted") {
        bucket.done += 1;
      }
      tasksByCourse.set(cid, bucket);
    }
    return data.courses.map((c) => {
      const bucket = tasksByCourse.get(c.id);
      const progress =
        bucket && bucket.total > 0
          ? Math.round((bucket.done / bucket.total) * 100)
          : 0;
      return {
        id: String(c.id),
        name: c.courseTitle || "课程",
        progress,
      };
    });
  }, [data]);

  const announcementItems = useMemo<AnnouncementSummaryItem[]>(() => {
    if (!data) return [];
    const threeDaysAgoMs = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return data.announcements.slice(0, 3).map((a) => {
      const createdAtMs = new Date(a.createdAt).getTime();
      return {
        id: String(a.id),
        title: a.title || "公告",
        courseId: a.courseId ?? null,
        courseTitle: a.course?.courseTitle || "",
        createdAt: a.createdAt,
        unread: createdAtMs >= threeDaysAgoMs,
        href: undefined,
      };
    });
  }, [data]);

  const unreadAnnouncementCount = useMemo(
    () => announcementItems.filter((a) => a.unread).length,
    [announcementItems],
  );

  const kpi = useMemo(() => {
    if (!data) {
      return {
        pending: 0,
        completedThisWeek: 0,
        avgScore: null as number | null,
        graded: 0,
      };
    }
    const pending = data.tasks.filter(isTaskPending).length;

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const dayOfWeek = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    const weekStartMs = weekStart.getTime();

    // PR-SIM-1c · D1 防作弊：avgScore 仅基于"已公布"提交，未公布的不算入 KPI
    const releasedSubs = data.recentSubmissions.filter((s) => {
      const status =
        (s.analysisStatus as SubmissionAnalysisStatus | undefined) ??
        deriveAnalysisStatus({
          status: String(s.status),
          releasedAt: (s.releasedAt ?? null) as string | null,
        });
      return status === "released" && s.score != null;
    });
    const completedThisWeek = data.recentSubmissions.filter((s) => {
      const ts = s.submittedAt ? new Date(s.submittedAt).getTime() : 0;
      return ts >= weekStartMs;
    }).length;

    const avgScore =
      releasedSubs.length > 0
        ? Math.round(
            (releasedSubs.reduce((acc, s) => {
              const norm =
                Number(s.maxScore) > 0
                  ? (Number(s.score) / Number(s.maxScore)) * 100
                  : Number(s.score);
              return acc + norm;
            }, 0) /
              releasedSubs.length) *
              10,
          ) / 10
        : null;

    return {
      pending,
      completedThisWeek,
      avgScore,
      graded: releasedSubs.length,
    };
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
  const jsDay = now.getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const todayLabel = WEEKDAY_LABELS[todayIdx];
  const weekLabel = currentWeekLabel(data.scheduleSlots, now);
  const dateLine = weekLabel
    ? `${buildDateLine(now)} · ${weekLabel}`
    : buildDateLine(now);

  const summaryParts: React.ComponentProps<typeof GreetingHero>["summaryParts"] = [];
  if (todaySlots.length > 0) {
    summaryParts.push({
      label: "节课",
      value: todaySlots.length,
      tone: "brand",
    });
  }
  if (kpi.pending > 0) {
    summaryParts.push({
      label: "项待办",
      value: kpi.pending,
      tone: "warn",
    });
  }

  const suffix = priorityTasks.find((t) => {
    if (!t.dueAt) return false;
    const hoursLeft =
      (new Date(t.dueAt).getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft <= 24;
  })
    ? "其中 1 项今晚截止"
    : undefined;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <GreetingHero
        name={displayName}
        dateLine={dateLine}
        summaryParts={summaryParts}
        suffix={suffix}
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiStatCard
          label="本周待办"
          value={kpi.pending}
          sub={`${kpi.completedThisWeek} 本周已完成`}
          icon={FileText}
          accent="brand"
        />
        <KpiStatCard
          label="本周完成"
          value={kpi.completedThisWeek}
          sub="次提交"
          icon={CheckCircle2}
          accent="ochre"
        />
        <KpiStatCard
          label="平均得分"
          value={kpi.avgScore != null ? kpi.avgScore.toFixed(1) : "—"}
          sub={kpi.graded > 0 ? `基于 ${kpi.graded} 次公布成绩` : "暂无公布成绩"}
          icon={TrendingUp}
          accent="success"
          trendUp={kpi.avgScore != null && kpi.avgScore >= 80}
        />
        <KpiStatCard
          label="已完成率"
          value={
            kpi.pending + kpi.completedThisWeek === 0
              ? "—"
              : `${Math.round(
                  (kpi.completedThisWeek /
                    (kpi.pending + kpi.completedThisWeek)) *
                    100,
                )}%`
          }
          sub="本周任务"
          icon={Target}
          accent="sim"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <TodayClasses slots={todaySlots} dayLabel={todayLabel} />
          <PriorityTasks tasks={priorityTasks} />
          <RecentGrades items={recentGrades} />
        </div>

        <div className="flex flex-col gap-5">
          <CourseProgressSidebar items={courseProgressItems} />
          <AnnouncementSummary
            items={announcementItems}
            unreadCount={unreadAnnouncementCount}
          />
          <AiBuddyCallout />
        </div>
      </div>
    </div>
  );
}
