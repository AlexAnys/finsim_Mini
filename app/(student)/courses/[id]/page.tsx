"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, BookOpen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CourseHero,
  type CourseDetailTabKey,
} from "@/components/course-detail/course-hero";
import {
  ChapterNav,
  type ChapterNavItem,
} from "@/components/course-detail/chapter-nav";
import {
  SectionTimeline,
  type SectionTimelineData,
} from "@/components/course-detail/section-timeline";
import {
  TeacherCard,
  MasterySection,
  AiHint,
  type MasteryItem,
} from "@/components/course-detail/right-sidebar";
import {
  computeChapterStatus,
  computeSectionState,
  computeSectionStatusLine,
  transformSectionBlocks,
  transformSectionTasks,
  type DashboardTaskState,
  type RawChapter,
} from "@/lib/utils/course-detail-transform";

interface CourseDetailApi {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  semesterStartDate: string | null;
  class: { id: string; name: string };
  classes?: Array<{ id: string; class: { id: string; name: string } }>;
  chapters: RawChapter[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DashboardSummary {
  tasks: Array<Record<string, any>>;
  recentSubmissions: Array<Record<string, any>>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function StudentCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseDetailApi | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CourseDetailTabKey>("content");
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function fetchAll() {
      try {
        const [courseRes, dashRes] = await Promise.all([
          fetch(`/api/lms/courses/${courseId}`),
          fetch("/api/lms/dashboard/summary"),
        ]);
        const [courseJson, dashJson] = await Promise.all([
          courseRes.json(),
          dashRes.json(),
        ]);
        if (aborted) return;
        if (!courseJson.success) {
          setError(courseJson.error?.message || "加载失败");
          return;
        }
        setCourse(courseJson.data);
        if (dashJson.success) {
          setDashboard(dashJson.data);
        }
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
  }, [courseId]);

  const studentStateById = useMemo(() => {
    const m = new Map<string, DashboardTaskState>();
    const tasks = dashboard?.tasks ?? [];
    for (const t of tasks) {
      m.set(t.id, {
        id: t.id,
        studentStatus: t.studentStatus ?? "todo",
        canSubmit: Boolean(t.canSubmit),
        latestScore: t.latestScore ?? null,
        latestMaxScore: t.latestMaxScore ?? null,
      });
    }
    return m;
  }, [dashboard]);

  const chapterAggregates = useMemo(() => {
    if (!course) return [];
    const semesterStart = course.semesterStartDate
      ? new Date(course.semesterStartDate)
      : null;
    return course.chapters.map((ch) => {
      const sections = ch.sections.map((sec) =>
        computeSectionState(ch.order, sec, studentStateById, semesterStart),
      );
      return {
        id: ch.id,
        order: ch.order,
        title: ch.title,
        sections,
        status: computeChapterStatus(sections),
      };
    });
  }, [course, studentStateById]);

  useEffect(() => {
    if (activeChapterId || chapterAggregates.length === 0) return;
    const firstActive = chapterAggregates.find((c) => c.status === "active");
    const fallback = chapterAggregates[0];
    const chosen = firstActive ?? fallback;
    if (chosen) setActiveChapterId(chosen.id);
  }, [chapterAggregates, activeChapterId]);

  const chapterNavItems = useMemo<ChapterNavItem[]>(
    () =>
      chapterAggregates.map((c) => ({
        id: c.id,
        number: c.order + 1,
        title: c.title,
        status: c.status,
      })),
    [chapterAggregates],
  );

  const activeChapter = useMemo(() => {
    if (!course || !activeChapterId) return null;
    return course.chapters.find((c) => c.id === activeChapterId) ?? null;
  }, [course, activeChapterId]);

  const activeChapterAggregate = useMemo(
    () => chapterAggregates.find((c) => c.id === activeChapterId) ?? null,
    [chapterAggregates, activeChapterId],
  );

  const activeSections = useMemo<SectionTimelineData[]>(() => {
    if (!activeChapter || !activeChapterAggregate) return [];
    return activeChapter.sections.map((sec) => {
      const agg = activeChapterAggregate.sections.find(
        (s) => s.id === sec.id,
      )!;
      const blocks = transformSectionBlocks(sec.contentBlocks);
      const tasks = transformSectionTasks(sec.taskInstances, studentStateById);
      return {
        id: sec.id,
        number: agg.number,
        title: sec.title,
        state: agg.state,
        blocks,
        tasks,
        statusLine: computeSectionStatusLine(agg),
      };
    });
  }, [activeChapter, activeChapterAggregate, studentStateById]);

  const courseMetrics = useMemo(() => {
    const chapters = chapterAggregates;
    const totalChapters = chapters.length;
    const completedChapters = chapters.filter(
      (c) => c.status === "done",
    ).length;
    const totalTasks = chapters.reduce(
      (acc, c) => acc + c.sections.reduce((s, x) => s + x.taskCount, 0),
      0,
    );
    const completedTasks = chapters.reduce(
      (acc, c) =>
        acc + c.sections.reduce((s, x) => s + x.completedTaskCount, 0),
      0,
    );
    const progressPct =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const instanceIds = new Set<string>();
    if (course) {
      for (const ch of course.chapters) {
        for (const sec of ch.sections) {
          for (const t of sec.taskInstances) instanceIds.add(t.id);
        }
      }
    }
    const gradedHere = (dashboard?.recentSubmissions ?? []).filter(
      (s) =>
        s.status === "graded" &&
        s.score != null &&
        s.maxScore != null &&
        instanceIds.has(s.taskInstanceId),
    );
    const avgScore =
      gradedHere.length > 0
        ? Math.round(
            gradedHere.reduce((acc, s) => {
              const norm =
                Number(s.maxScore) > 0
                  ? (Number(s.score) / Number(s.maxScore)) * 100
                  : Number(s.score);
              return acc + norm;
            }, 0) / gradedHere.length,
          )
        : null;

    const pendingTasks = chapters.reduce(
      (acc, c) =>
        acc +
        c.sections.reduce(
          (s, x) => s + (x.taskCount - x.completedTaskCount),
          0,
        ),
      0,
    );

    return {
      totalChapters,
      completedChapters,
      totalTasks,
      completedTasks,
      pendingTasks,
      progressPct,
      avgScore,
    };
  }, [chapterAggregates, dashboard, course]);

  const masteryItems = useMemo<MasteryItem[]>(() => {
    if (!activeChapterAggregate) return [];
    return activeChapterAggregate.sections.map((s) => {
      let pct = 0;
      if (s.taskCount > 0) {
        pct = Math.round((s.completedTaskCount / s.taskCount) * 100);
      }
      return {
        id: s.id,
        name: s.title,
        pct,
        locked: s.state === "locked",
      };
    });
  }, [activeChapterAggregate]);

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

  if (!course) return null;

  const className =
    course.classes && course.classes.length > 0
      ? course.classes
          .map((cc) => cc.class?.name)
          .filter(Boolean)
          .join(" / ")
      : course.class?.name ?? null;

  return (
    <div className="flex flex-col gap-0">
      <CourseHero
        courseTitle={course.courseTitle}
        courseCode={course.courseCode}
        description={course.description}
        teacherName={null}
        className={className}
        progressPct={courseMetrics.progressPct}
        completedChapters={courseMetrics.completedChapters}
        totalChapters={courseMetrics.totalChapters}
        avgScore={courseMetrics.avgScore}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        taskBadgeCount={courseMetrics.pendingTasks}
      />

      {activeTab !== "content" ? (
        <div className="grid place-items-center py-16 text-center">
          <p className="text-sm text-ink-4">该视图将在后续版本中上线。</p>
        </div>
      ) : course.chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <BookOpen className="size-12 text-ink-5" />
          <p className="text-sm text-ink-4">暂无课程内容</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
          <ChapterNav
            items={chapterNavItems}
            activeId={activeChapterId}
            onSelect={setActiveChapterId}
          />

          <div className="min-w-0 space-y-4">
            {activeChapterAggregate && (
              <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
                    第 {activeChapterAggregate.order + 1} 章 · 本章内容
                  </div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
                    {activeChapterAggregate.title}
                  </h2>
                  <p className="mt-1 text-[13px] text-ink-3">
                    {activeChapterAggregate.sections.length} 节 ·{" "}
                    {activeChapterAggregate.sections.reduce(
                      (acc, s) => acc + s.taskCount,
                      0,
                    )}{" "}
                    项任务
                  </p>
                </div>
                {courseMetrics.pendingTasks > 0 && (
                  <Button variant="secondary" size="sm">
                    <Play className="size-[11px]" />
                    继续上次
                  </Button>
                )}
              </header>
            )}

            {activeSections.length === 0 ? (
              <p className="text-sm text-ink-4">本章暂无小节内容。</p>
            ) : (
              activeSections.map((sec) => (
                <SectionTimeline key={sec.id} data={sec} />
              ))
            )}
          </div>

          <aside className="space-y-4">
            <TeacherCard name={null} titleLine="任课教师" initial="师" />
            <MasterySection items={masteryItems} />
            <AiHint text="完成预读材料后再进入模拟对话，效率会显著提升。" />
          </aside>
        </div>
      )}
    </div>
  );
}
