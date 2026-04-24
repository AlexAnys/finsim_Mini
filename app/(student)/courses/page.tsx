"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, AlertCircle } from "lucide-react";
import {
  CourseCard,
  type CourseCardData,
} from "@/components/dashboard/course-card";
import {
  CourseSummaryStrip,
  type SummaryStripItem,
} from "@/components/dashboard/course-summary-strip";
import { deriveNextLesson, type NextLessonSlot } from "@/lib/utils/next-lesson";

interface CourseClassItem {
  id: string;
  classId: string;
  class: { id: string; name: string };
}

interface CourseApiItem {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  createdAt: string;
  class: { id: string; name: string };
  classes?: CourseClassItem[];
}

interface DashboardTask {
  id: string;
  course?: { id?: string } | null;
  courseId?: string | null;
  studentStatus: string;
  dueAt?: string | null;
}

interface DashboardSubmission {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  taskInstanceId: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
}

interface DashboardData {
  tasks: DashboardTask[];
  recentSubmissions: DashboardSubmission[];
  scheduleSlots: NextLessonSlot[];
}

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<CourseApiItem[] | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function fetchAll() {
      try {
        const [coursesRes, dashRes] = await Promise.all([
          fetch("/api/lms/courses"),
          fetch("/api/lms/dashboard/summary"),
        ]);
        const [coursesJson, dashJson] = await Promise.all([
          coursesRes.json(),
          dashRes.json(),
        ]);
        if (aborted) return;

        if (!coursesJson.success) {
          setError(coursesJson.error?.message || "加载课程失败");
          return;
        }
        setCourses(coursesJson.data);

        if (dashJson.success) {
          setDashboard(dashJson.data);
        }
        // dashboard is best-effort — if it fails, cards degrade to basic display
      } catch {
        if (!aborted) setError("网络错误，请稍后重试");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      aborted = true;
    };
  }, []);

  const courseCards = useMemo<CourseCardData[]>(() => {
    if (!courses) return [];
    const tasks = dashboard?.tasks ?? [];
    const submissions = dashboard?.recentSubmissions ?? [];
    const scheduleSlots = dashboard?.scheduleSlots ?? [];

    const instanceToCourse = new Map<string, string>();
    for (const t of tasks) {
      const cid = t.course?.id ?? t.courseId;
      if (cid) instanceToCourse.set(t.id, cid);
    }

    return courses.map((c) => {
      const courseTasks = tasks.filter(
        (t) => (t.course?.id ?? t.courseId) === c.id,
      );
      const totalTasks = courseTasks.length;
      const submittedCount = courseTasks.filter(
        (t) =>
          t.studentStatus === "submitted" || t.studentStatus === "graded",
      ).length;
      const progress =
        totalTasks > 0
          ? Math.round((submittedCount / totalTasks) * 100)
          : 0;

      const courseGradedSubs = submissions.filter(
        (s) =>
          s.status === "graded" &&
          s.score != null &&
          s.maxScore != null &&
          s.taskInstanceId != null &&
          instanceToCourse.get(s.taskInstanceId) === c.id,
      );
      const avgScore =
        courseGradedSubs.length > 0
          ? Math.round(
              courseGradedSubs.reduce((acc, s) => {
                const norm =
                  Number(s.maxScore) > 0
                    ? (Number(s.score) / Number(s.maxScore)) * 100
                    : Number(s.score);
                return acc + norm;
              }, 0) / courseGradedSubs.length,
            )
          : null;

      const classNames: string[] = [];
      if (c.classes && c.classes.length > 0) {
        for (const cc of c.classes) {
          if (cc.class?.name) classNames.push(cc.class.name);
        }
      } else if (c.class?.name) {
        classNames.push(c.class.name);
      }

      const nextLesson = deriveNextLesson(c.id, scheduleSlots);

      return {
        id: c.id,
        courseTitle: c.courseTitle,
        courseCode: c.courseCode,
        description: c.description,
        classNames,
        progress,
        submittedCount,
        totalTasks,
        avgScore,
        nextLesson,
      };
    });
  }, [courses, dashboard]);

  const summaryItems = useMemo<SummaryStripItem[]>(() => {
    if (!courses || courseCards.length === 0) return [];

    const avgProgress = Math.round(
      courseCards.reduce((acc, c) => acc + c.progress, 0) / courseCards.length,
    );

    const tasks = dashboard?.tasks ?? [];
    const pending = tasks.filter(
      (t) => t.studentStatus === "todo" || t.studentStatus === "overdue",
    ).length;
    const dueTodayCount = tasks.filter((t) => {
      if (!t.dueAt) return false;
      const due = new Date(t.dueAt);
      const now = new Date();
      return (
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate() &&
        t.studentStatus !== "submitted" &&
        t.studentStatus !== "graded"
      );
    }).length;

    const submissions = dashboard?.recentSubmissions ?? [];
    const gradedSubs = submissions.filter(
      (s) =>
        s.status === "graded" && s.score != null && s.maxScore != null,
    );
    const overallAvg =
      gradedSubs.length > 0
        ? Math.round(
            gradedSubs.reduce((acc, s) => {
              const norm =
                Number(s.maxScore) > 0
                  ? (Number(s.score) / Number(s.maxScore)) * 100
                  : Number(s.score);
              return acc + norm;
            }, 0) / gradedSubs.length,
          )
        : null;

    const totalSubmitted = courseCards.reduce(
      (acc, c) => acc + c.submittedCount,
      0,
    );
    const totalTasks = courseCards.reduce((acc, c) => acc + c.totalTasks, 0);

    return [
      {
        label: "平均完成度",
        value: avgProgress,
        suffix: "%",
        sub: "基于任务完成率",
      },
      {
        label: "本周待办",
        value: pending,
        suffix: "项",
        sub: dueTodayCount > 0 ? `${dueTodayCount} 项今日截止` : "暂无紧急",
        tone: dueTodayCount > 0 ? "warn" : "default",
      },
      {
        label: "平均分",
        value: overallAvg ?? "—",
        suffix: overallAvg != null ? "分" : "",
        sub:
          gradedSubs.length > 0
            ? `基于 ${gradedSubs.length} 次批改`
            : "暂无批改",
      },
      {
        label: "已完成任务",
        value: totalSubmitted,
        suffix: `/${totalTasks}`,
        sub: "全部课程",
        tone: "success",
      },
    ];
  }, [courses, courseCards, dashboard]);

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

  if (!courses || courses.length === 0) {
    return (
      <div className="mx-auto max-w-[1320px] space-y-6">
        <header>
          <h1 className="text-[26px] font-bold tracking-[-0.01em] text-ink">
            我的课程
          </h1>
        </header>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface py-12">
          <BookOpen className="size-12 text-ink-5" />
          <p className="text-sm text-ink-4">暂无课程</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] space-y-5">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            本学期
          </div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em] text-ink">
            我的课程
          </h1>
          <p className="mt-1 text-[13px] text-ink-4">
            {courses.length} 门课程 ·{" "}
            {courseCards.reduce((acc, c) => acc + c.totalTasks, 0)} 项任务 ·
            已完成{" "}
            {courseCards.reduce((acc, c) => acc + c.submittedCount, 0)}/
            {courseCards.reduce((acc, c) => acc + c.totalTasks, 0)}
          </p>
        </div>
      </header>

      {summaryItems.length > 0 && <CourseSummaryStrip items={summaryItems} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {courseCards.map((c) => (
          <CourseCard key={c.id} data={c} />
        ))}
      </div>
    </div>
  );
}
