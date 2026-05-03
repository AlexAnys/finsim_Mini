"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  Loader2,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InsightsFilterBar } from "@/components/analytics-v2/insights-filter-bar";
import { KpiRow, type KpiKind } from "@/components/analytics-v2/kpi-row";
import { TaskPerformanceBlock } from "@/components/analytics-v2/task-performance-block";
import { StudyBuddyBlock } from "@/components/analytics-v2/study-buddy-block";
import { TeachingAdviceBlock } from "@/components/analytics-v2/teaching-advice-block";
import {
  EvidenceDrawer,
  type EvidenceItem,
} from "@/components/analytics-v2/evidence-drawer";
import {
  RiskDrawer,
  type RiskDrawerKind,
  type RiskDrawerState,
} from "@/components/analytics-v2/risk-drawer";
import type {
  ScoreDistributionBin,
} from "@/components/analytics-v2/score-distribution-chart";
import type {
  ScopeSimulationInsight as ScopeSimulationInsightShape,
  ScopeStudyBuddySummary as ScopeStudyBuddySummaryShape,
  ScopeTeachingAdvice as ScopeTeachingAdviceShape,
} from "@/lib/services/scope-insights.service";
import { cn } from "@/lib/utils";

const ScoreDistributionChart = dynamic(
  () => import("@/components/analytics-v2/score-distribution-chart"),
  {
    ssr: false,
    loading: () => (
      <Card className="rounded-lg flex h-full flex-col">
        <CardContent className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          正在加载图表
        </CardContent>
      </Card>
    ),
  },
);

type TaskType = "simulation" | "quiz" | "subjective";
type ScorePolicy = "latest" | "best" | "first";
type RangeValue = "7d" | "30d" | "term";

interface CourseOption {
  id: string;
  courseTitle: string;
  class?: { id: string; name: string } | null;
}

interface AnalyticsV2Diagnosis {
  scope: {
    courseId: string;
    courseTitle: string;
    chapterId: string | null;
    sectionId: string | null;
    classIds: string[];
    taskType: TaskType | null;
    taskInstanceId: string | null;
    scorePolicy: ScorePolicy;
    range: RangeValue;
    generatedAt: string;
  };
  filterOptions: {
    classes: Array<{ id: string; name: string }>;
    chapters: Array<{ id: string; title: string; order: number }>;
    sections: Array<{ id: string; title: string; chapterId: string; order: number }>;
    taskTypes: Array<{ value: TaskType; label: string; count: number }>;
    taskInstances: Array<{
      id: string;
      title: string;
      taskType: TaskType;
      classId: string;
      className: string;
      chapterId: string | null;
      sectionId: string | null;
    }>;
  };
  kpis: {
    instanceCount: number;
    assignedStudents: number;
    submittedStudents: number;
    gradedStudents: number;
    submissionCount: number;
    attemptCount: number;
    completionRate: number | null;
    avgNormalizedScore: number | null;
    medianNormalizedScore: number | null;
    passRate: number | null;
    pendingReleaseCount: number;
    pendingReleaseTaskCount: number;
    weeklyHistory: Array<{ weekStart: string; completionRate: number | null; avgNormalizedScore: number | null }>;
    previousWeekCompletionRate: number | null;
    previousWeekAvgScore: number | null;
  };
  chapterClassHeatmap: Array<unknown>;
  actionItems: Array<unknown>;
  chapterDiagnostics: Array<{
    chapterId: string | null;
    title: string;
    instanceCount: number;
    assignedStudents: number;
    submittedStudents: number;
    completionRate: number | null;
    avgNormalizedScore: number | null;
    weaknesses: Array<{ tag: string; count: number }>;
  }>;
  instanceDiagnostics: Array<{
    instanceId: string;
    title: string;
    taskType: TaskType;
    className: string;
    chapterId: string | null;
    chapterTitle: string | null;
    assignedStudents: number;
    submittedStudents: number;
    completionRate: number | null;
    avgNormalizedScore: number | null;
    medianNormalizedScore: number | null;
    passRate: number | null;
    attemptCount: number;
    weaknesses: Array<{ tag: string; count: number }>;
  }>;
  quizDiagnostics: Array<unknown>;
  simulationDiagnostics: Array<unknown>;
  studentInterventions: Array<{
    studentId: string;
    studentName: string;
    instanceTitle: string;
    className: string;
    attemptCount: number;
    bestScore: number | null;
    improvement: number | null;
    selectedScore: number | null;
    reason: "not_submitted" | "low_score" | "declining";
  }>;
  dataQualityFlags: DataQualityFlag[];
  scoreDistribution: {
    bins: Array<{
      label: string;
      min: number;
      max: number;
      classes: Array<{
        classId: string;
        classLabel: string;
        students: Array<{ id: string; name: string; score: number; taskInstanceId?: string }>;
      }>;
    }>;
    binCount: number;
    scope: "single_task" | "multi_task";
    totalStudents: number;
  };
  weeklyInsight: unknown;
  trends: unknown;
}

interface DataQualityFlag {
  id: string;
  severity: "info" | "warning" | "critical";
  category: "scope" | "assignment" | "score" | "attempt" | "sample" | "aggregation";
  title: string;
  detail: string;
  entityType: "course" | "chapter" | "class" | "instance" | "student" | "submission";
  entityId?: string | null;
  entityLabel?: string | null;
  metric?: number | null;
  rawValue?: string | null;
}

interface AsyncJobSnapshot {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
  result?: unknown;
  error?: string | null;
  completedAt?: string | null;
}

const ALL = "__all__";

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  simulation: "模拟练习",
  quiz: "测验",
  subjective: "主观题",
};

const SCORE_POLICY_LABELS: Record<ScorePolicy, string> = {
  latest: "最近一次",
  best: "最高分",
  first: "首次",
};

const RANGE_LABELS: Record<RangeValue, string> = {
  term: "本学期",
  "30d": "近 30 天",
  "7d": "近 7 天",
};

const LAST_COURSE_KEY_PREFIX = "insights:last-course:";

export function AnalyticsV2Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState<AnalyticsV2Diagnosis | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [recomputeJob, setRecomputeJob] = useState<AsyncJobSnapshot | null>(null);
  const [recomputeStarting, setRecomputeStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeInsights, setScopeInsights] = useState<{
    simulation: ScopeSimulationInsightShape | null;
    studyBuddy: ScopeStudyBuddySummaryShape | null;
    teachingAdvice: ScopeTeachingAdviceShape | null;
  }>({ simulation: null, studyBuddy: null, teachingAdvice: null });
  const [scopeInsightsLoading, setScopeInsightsLoading] = useState(false);
  const [scopeInsightsRefreshing, setScopeInsightsRefreshing] = useState(false);
  const [riskDrawerOpen, setRiskDrawerOpen] = useState(false);
  const [riskDrawerState, setRiskDrawerState] = useState<RiskDrawerState | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [taskPerfTaskId, setTaskPerfTaskId] = useState<string>("");
  const [dataQualityOpen, setDataQualityOpen] = useState(false);

  const courseId = searchParams.get("courseId") ?? "";
  const classIds = useMemo(() => {
    const multi = searchParams.getAll("classIds");
    if (multi.length > 0) return multi;
    const legacy = searchParams.get("classId");
    return legacy ? [legacy] : [];
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      setCoursesLoading(true);
      try {
        const res = await fetch("/api/lms/courses?take=200");
        const json = await res.json();
        if (!cancelled) {
          if (json.success) setCourses(json.data ?? []);
          else setError(json.error?.message ?? "加载课程失败");
        }
      } catch {
        if (!cancelled) setError("加载课程失败");
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    }
    fetchCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  const lastCourseAppliedRef = useRef(false);

  useEffect(() => {
    if (lastCourseAppliedRef.current) return;
    if (!userId || coursesLoading) return;
    if (courseId) {
      lastCourseAppliedRef.current = true;
      return;
    }
    if (courses.length === 0) {
      lastCourseAppliedRef.current = true;
      return;
    }
    let candidate: string | null = null;
    try {
      const stored = window.localStorage.getItem(`${LAST_COURSE_KEY_PREFIX}${userId}`);
      if (stored && courses.some((c) => c.id === stored)) {
        candidate = stored;
      }
    } catch {
      // ignore
    }
    if (!candidate) {
      candidate = courses[0]?.id ?? null;
    }
    if (candidate) {
      lastCourseAppliedRef.current = true;
      const next = new URLSearchParams(searchParams.toString());
      next.set("courseId", candidate);
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [
    userId,
    coursesLoading,
    courses,
    courseId,
    pathname,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (!userId || !courseId) return;
    try {
      window.localStorage.setItem(`${LAST_COURSE_KEY_PREFIX}${userId}`, courseId);
    } catch {
      // ignore
    }
  }, [userId, courseId]);

  useEffect(() => {
    if (!courseId) {
      setDiagnosis(null);
      setRecomputeJob(null);
      return;
    }

    const controller = new AbortController();
    async function fetchDiagnosis() {
      setDiagnosisLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(searchParams.toString());
        const res = await fetch(`/api/lms/analytics-v2/diagnosis?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (json.success) {
          setDiagnosis(json.data);
        } else {
          setDiagnosis(null);
          setError(json.error?.message ?? "加载诊断失败");
        }
      } catch {
        if (!controller.signal.aborted) {
          setDiagnosis(null);
          setError("加载诊断失败");
        }
      } finally {
        if (!controller.signal.aborted) setDiagnosisLoading(false);
      }
    }
    fetchDiagnosis();
    return () => controller.abort();
  }, [courseId, searchParams]);

  useEffect(() => {
    if (!courseId) {
      setScopeInsights({ simulation: null, studyBuddy: null, teachingAdvice: null });
      return;
    }
    const controller = new AbortController();
    async function fetchScopeInsights() {
      setScopeInsightsLoading(true);
      try {
        const params = new URLSearchParams(searchParams.toString());
        const res = await fetch(`/api/lms/analytics-v2/scope-insights?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (json.success) {
          setScopeInsights({
            simulation: json.data.simulation ?? null,
            studyBuddy: json.data.studyBuddy ?? null,
            teachingAdvice: json.data.teachingAdvice ?? null,
          });
        } else {
          setScopeInsights({ simulation: null, studyBuddy: null, teachingAdvice: null });
        }
      } catch {
        if (!controller.signal.aborted) {
          setScopeInsights({ simulation: null, studyBuddy: null, teachingAdvice: null });
        }
      } finally {
        if (!controller.signal.aborted) setScopeInsightsLoading(false);
      }
    }
    fetchScopeInsights();
    return () => controller.abort();
  }, [courseId, searchParams]);

  async function refreshScopeInsights() {
    if (!courseId || scopeInsightsRefreshing) return;
    setScopeInsightsRefreshing(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/lms/analytics-v2/scope-insights?${params.toString()}`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setScopeInsights({
          simulation: json.data.simulation ?? null,
          studyBuddy: json.data.studyBuddy ?? null,
          teachingAdvice: json.data.teachingAdvice ?? null,
        });
      } else {
        setError(json.error?.message ?? "重新生成失败");
      }
    } catch {
      setError("重新生成失败");
    } finally {
      setScopeInsightsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!recomputeJob || recomputeJob.status === "succeeded" || recomputeJob.status === "failed" || recomputeJob.status === "canceled") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/async-jobs/${recomputeJob.id}`, { cache: "no-store" });
        const json = await res.json();
        if (!json.success) return;
        const job = json.data as AsyncJobSnapshot;
        setRecomputeJob(job);
        if (job.status === "succeeded" && isAnalyticsDiagnosis(job.result)) {
          setDiagnosis(job.result);
        }
      } catch {
        // Keep the last known job state; the next poll can recover.
      }
    }, 1200);

    return () => window.clearInterval(timer);
  }, [recomputeJob]);

  const defaultClassIdsAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      defaultClassIdsAppliedRef.current = null;
      return;
    }
    if (defaultClassIdsAppliedRef.current === courseId) return;
    if (!diagnosis) return;
    if (diagnosis.scope.courseId !== courseId) return;
    if (classIds.length > 0) {
      defaultClassIdsAppliedRef.current = courseId;
      return;
    }
    const allClassIds = diagnosis.filterOptions.classes.map((c) => c.id);
    if (allClassIds.length === 0) {
      defaultClassIdsAppliedRef.current = courseId;
      return;
    }
    defaultClassIdsAppliedRef.current = courseId;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("classIds");
    for (const id of allClassIds) next.append("classIds", id);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [courseId, diagnosis, classIds, searchParams, pathname, router]);

  const scopeTags = useMemo(() => buildScopeTags(diagnosis), [diagnosis]);

  const simulationTaskOptions = useMemo(() => {
    if (!diagnosis) return [];
    return diagnosis.filterOptions.taskInstances
      .filter((t) => t.taskType === "simulation")
      .map((t) => ({ id: t.id, title: t.title, className: t.className }));
  }, [diagnosis]);

  function replaceQuery(updates: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === ALL || value === "") {
        next.delete(key);
        continue;
      }
      if (Array.isArray(value)) {
        next.delete(key);
        for (const item of value) {
          if (item) next.append(key, item);
        }
        continue;
      }
      next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    if (!courseId) return;
    defaultClassIdsAppliedRef.current = null;
    router.replace(`${pathname}?courseId=${encodeURIComponent(courseId)}`);
  }

  async function startRecompute() {
    if (!courseId || recomputeStarting || isJobRunning(recomputeJob)) return;
    setRecomputeStarting(true);
    setError(null);
    try {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/lms/analytics-v2/recompute?${params.toString()}`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setRecomputeJob(json.data.job);
      } else {
        setError(json.error?.message ?? "启动重算失败");
      }
    } catch {
      setError("启动重算失败");
    } finally {
      setRecomputeStarting(false);
    }
  }

  const studentNamesById = useMemo(() => {
    const map = new Map<string, string>();
    if (diagnosis) {
      for (const row of diagnosis.studentInterventions) {
        if (!map.has(row.studentId)) map.set(row.studentId, row.studentName);
      }
    }
    return map;
  }, [diagnosis]);

  async function openRiskDrawerByKind(
    kind: RiskDrawerKind,
    extra?: Record<string, string>,
  ) {
    if (!courseId) return;
    setRiskDrawerOpen(true);
    setRiskDrawerState({ kind, loading: true, items: [], error: null });
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("kind", kind);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) params.set(k, v);
      }
      const res = await fetch(`/api/lms/analytics-v2/drilldown?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRiskDrawerState({ kind, loading: false, items: json.data.items ?? [], error: null });
      } else {
        setRiskDrawerState({ kind, loading: false, items: [], error: json.error?.message ?? "加载失败" });
      }
    } catch {
      setRiskDrawerState({ kind, loading: false, items: [], error: "加载失败" });
    }
  }

  function handleKpiClick(kind: KpiKind) {
    if (kind === "risk_signal") {
      void openRiskDrawerByKind("risk_chapter");
      return;
    }
    void openRiskDrawerByKind(kind);
  }

  function openEvidence(item: EvidenceItem) {
    setEvidence(item);
    setEvidenceOpen(true);
  }

  function handleBinClick(bin: ScoreDistributionBin, classId: string) {
    void openRiskDrawerByKind("score_bin", {
      binLabel: bin.label,
      binClassId: classId,
    });
  }

  function handleViewAllScores() {
    if (!courseId || !diagnosis) return;
    const firstBin = diagnosis.scoreDistribution.bins[0];
    if (!firstBin) return;
    void openRiskDrawerByKind("score_bin", {
      binLabel: firstBin.label,
    });
  }

  if (coursesLoading) {
    return <CenteredState icon={Loader2} title="正在加载课程" spinning />;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        "h-[calc(100vh-3.5rem-3rem)]",
        "overflow-hidden",
      )}
    >
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-normal">数据洞察</h1>
        </div>
        <div className="flex flex-1 min-w-0 items-center justify-end">
          <InsightsFilterBar
            courses={courses}
            diagnosis={diagnosis}
            coursesLoading={coursesLoading}
            searchParams={searchParams}
            recomputeJob={recomputeJob}
            recomputeStarting={recomputeStarting}
            scopeTags={scopeTags}
            generatedAt={diagnosis?.scope.generatedAt ?? null}
            onReplaceQuery={replaceQuery}
            onReset={resetFilters}
            onStartRecompute={startRecompute}
          />
        </div>
      </div>

      {!courseId ? (
        <CenteredState
          icon={Target}
          title={courses.length === 0 ? "暂无可分析课程" : "请选择课程"}
          description={courses.length === 0 ? "创建课程并发布任务实例后，可在这里查看数据洞察。" : "课程是数据洞察的必选范围。"}
        />
      ) : error ? (
        <CenteredState icon={AlertCircle} title={error} />
      ) : diagnosisLoading && !diagnosis ? (
        <InsightsSkeleton />
      ) : diagnosis ? (
        <>
          <div className="shrink-0">
            <KpiRow diagnosis={diagnosis} onKpiClick={handleKpiClick} />
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-3 overflow-hidden">
            <ScoreDistributionChart
              distribution={diagnosis.scoreDistribution}
              onBinClick={handleBinClick}
              onViewAll={handleViewAllScores}
            />
            <TaskPerformanceBlock
              data={scopeInsights.simulation}
              loading={scopeInsightsLoading && !scopeInsights.simulation}
              refreshing={scopeInsightsRefreshing}
              onRefresh={refreshScopeInsights}
              onOpenEvidence={openEvidence}
              taskOptions={simulationTaskOptions}
              selectedTaskId={taskPerfTaskId}
              onTaskChange={setTaskPerfTaskId}
            />
            <StudyBuddyBlock
              data={scopeInsights.studyBuddy}
              loading={scopeInsightsLoading && !scopeInsights.studyBuddy}
              onOpenEvidence={openEvidence}
            />
          </div>

          <div className="shrink-0">
            <TeachingAdviceBlock
              data={scopeInsights.teachingAdvice}
              loading={scopeInsightsLoading && !scopeInsights.teachingAdvice}
              refreshing={scopeInsightsRefreshing}
              onRefresh={refreshScopeInsights}
              studentNamesById={studentNamesById}
            />
          </div>

          <DataQualityCollapsible
            flags={diagnosis.dataQualityFlags ?? []}
            open={dataQualityOpen}
            onToggle={() => setDataQualityOpen((v) => !v)}
          />
        </>
      ) : null}

      <RiskDrawer
        open={riskDrawerOpen}
        onOpenChange={(open) => {
          setRiskDrawerOpen(open);
          if (!open) setTimeout(() => setRiskDrawerState(null), 200);
        }}
        state={riskDrawerState}
      />
      <EvidenceDrawer
        open={evidenceOpen}
        onOpenChange={(open) => {
          setEvidenceOpen(open);
          if (!open) setTimeout(() => setEvidence(null), 200);
        }}
        evidence={evidence}
      />
    </div>
  );
}

function DataQualityCollapsible({
  flags,
  open,
  onToggle,
}: {
  flags: DataQualityFlag[];
  open: boolean;
  onToggle: () => void;
}) {
  if (flags.length === 0) return null;
  const criticalCount = flags.filter((flag) => flag.severity === "critical").length;
  const warningCount = flags.filter((flag) => flag.severity === "warning").length;
  const sortedFlags = [...flags].sort(compareDataQualityFlag);
  return (
    <div className="shrink-0 rounded-md border border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-amber-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="size-3.5 text-amber-700" />
          <span className="text-xs font-medium">数据质量提示</span>
          <Badge variant="outline" className="rounded-md border-amber-300 bg-background text-[10px]">
            {flags.length} 项
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            严重 {criticalCount} · 需核对 {warningCount} · 信息 {flags.length - criticalCount - warningCount}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-amber-200 bg-background/40 max-h-[180px] overflow-y-auto px-3 py-2">
          <div className="grid gap-2 lg:grid-cols-2">
            {sortedFlags.map((flag) => (
              <div
                key={flag.id}
                className="rounded-md border bg-background px-2.5 py-1.5"
                title={flag.detail}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-[11px] font-medium">{flag.title}</div>
                  <Badge
                    variant={flag.severity === "critical" ? "destructive" : "outline"}
                    className="shrink-0 rounded-md text-[10px]"
                  >
                    {dataQualitySeverityLabel(flag.severity)}
                  </Badge>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                  {flag.entityLabel ? `${flag.entityLabel}：` : ""}
                  {flag.detail}
                </div>
                {flag.rawValue && (
                  <div className="mt-0.5 text-[10px] text-amber-700">原始值：{flag.rawValue}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0" aria-busy="true" aria-label="正在生成诊断">
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 shrink-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[100px] animate-pulse rounded-lg border bg-muted/30"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 flex-1 min-h-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border bg-muted/30"
          />
        ))}
      </div>
      <div className="h-[200px] animate-pulse rounded-lg border bg-muted/30 shrink-0" />
    </div>
  );
}

function CenteredState({
  icon: Icon,
  title,
  description,
  spinning = false,
}: {
  icon: typeof BarChart3;
  title: string;
  description?: string;
  spinning?: boolean;
}) {
  return (
    <Card className="rounded-lg flex-1">
      <CardContent className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
        <Icon className={cn("size-9 text-muted-foreground", spinning && "animate-spin")} />
        <div className="mt-4 font-medium">{title}</div>
        {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

function buildScopeTags(diagnosis: AnalyticsV2Diagnosis | null): string[] {
  if (!diagnosis) return [];
  const { scope, filterOptions } = diagnosis;
  const chapterTitle = filterOptions.chapters.find((item) => item.id === scope.chapterId)?.title;
  const sectionTitle = filterOptions.sections.find((item) => item.id === scope.sectionId)?.title;
  const instanceTitle = filterOptions.taskInstances.find((item) => item.id === scope.taskInstanceId)?.title;
  const allClassCount = filterOptions.classes.length;
  const selectedCount = scope.classIds.length;
  const isAllClasses =
    selectedCount === 0 || (allClassCount > 0 && selectedCount === allClassCount);
  let classTag = "班级：全部";
  if (!isAllClasses) {
    const names = scope.classIds
      .map((id) => filterOptions.classes.find((item) => item.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) classTag = `班级：${names.join(" / ")}`;
  }
  return [
    `课程：${scope.courseTitle}`,
    chapterTitle ? `章节：${chapterTitle}` : "章节：全部",
    sectionTitle ? `小节：${sectionTitle}` : "小节：全部",
    classTag,
    scope.taskType ? `模式：${TASK_TYPE_LABELS[scope.taskType]}` : "模式：全部",
    instanceTitle ? `实例：${instanceTitle}` : "实例：全部",
    `口径：${SCORE_POLICY_LABELS[scope.scorePolicy]}`,
    `时间：${RANGE_LABELS[scope.range]}`,
  ];
}

function compareDataQualityFlag(a: DataQualityFlag, b: DataQualityFlag) {
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title, "zh-CN");
}

function dataQualitySeverityLabel(severity: DataQualityFlag["severity"]) {
  if (severity === "critical") return "严重";
  if (severity === "warning") return "需核对";
  return "提示";
}

function isJobRunning(job: AsyncJobSnapshot | null) {
  return job?.status === "queued" || job?.status === "running";
}

function isAnalyticsDiagnosis(value: unknown): value is AnalyticsV2Diagnosis {
  return Boolean(
    value &&
      typeof value === "object" &&
      "scope" in value &&
      "kpis" in value &&
      "chapterClassHeatmap" in value,
  );
}
