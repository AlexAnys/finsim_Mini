"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Loader2,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InsightsFilterBar } from "@/components/analytics-v2/insights-filter-bar";
import { KpiRow } from "@/components/analytics-v2/kpi-row";
import { InsightsGrid } from "@/components/analytics-v2/insights-grid";
import {
  RiskDrawer,
  type RiskDrawerKind,
  type RiskDrawerState,
} from "@/components/analytics-v2/risk-drawer";
import type {
  ScopeSimulationInsight as ScopeSimulationInsightShape,
  ScopeStudyBuddySummary as ScopeStudyBuddySummaryShape,
  ScopeTeachingAdvice as ScopeTeachingAdviceShape,
} from "@/lib/services/scope-insights.service";
import { cn } from "@/lib/utils";

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
  };
  chapterClassHeatmap: Array<{
    chapterId: string | null;
    chapterTitle: string;
    classId: string;
    className: string;
    assignedStudents: number;
    submittedStudents: number;
    completionRate: number | null;
    avgNormalizedScore: number | null;
  }>;
  actionItems: Array<{
    type: "low_completion" | "low_score" | "weak_concept";
    severity: "high" | "medium";
    title: string;
    metric: number;
  }>;
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
  quizDiagnostics: Array<{
    questionId: string;
    order: number;
    prompt: string;
    correctRate: number | null;
    unansweredRate: number | null;
    avgScoreRate: number | null;
    weakTags: string[];
  }>;
  simulationDiagnostics: Array<{
    criterionId: string;
    criterionName: string;
    avgScoreRate: number | null;
    lowScoreCount: number;
    weakStudents: Array<{ studentId: string; studentName: string }>;
    sampleComments: string[];
  }>;
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
  weeklyInsight: {
    generatedAt: string;
    mode: "local_fallback";
    label: string;
    highlights: InsightItem[];
    risks: InsightItem[];
    recommendations: InsightItem[];
  };
  trends: {
    generatedAt: string;
    range: RangeValue;
    chapterTrend: Array<{
      chapterId: string | null;
      title: string;
      order: number | null;
      instanceCount: number;
      completionRate: number | null;
      avgNormalizedScore: number | null;
      latestActivityAt: string | null;
    }>;
    classTrend: Array<{
      classId: string;
      className: string;
      instanceCount: number;
      assignedStudents: number;
      submittedStudents: number;
      completionRate: number | null;
      avgNormalizedScore: number | null;
      latestActivityAt: string | null;
    }>;
    studentGrowth: Array<{
      studentId: string;
      studentName: string;
      classId: string;
      className: string;
      selectedScore: number | null;
      bestScore: number | null;
      improvement: number | null;
      attemptCount: number;
      completedInstances: number;
      firstSubmittedAt: string | null;
      latestSubmittedAt: string | null;
    }>;
  };
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

interface InsightItem {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  severity: "info" | "medium" | "high";
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

export function AnalyticsV2Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  async function openRiskDrawer(kind: RiskDrawerKind) {
    if (!courseId) return;
    setRiskDrawerOpen(true);
    setRiskDrawerState({ kind, loading: true, items: [], error: null });
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("kind", kind);
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

  if (coursesLoading) {
    return <CenteredState icon={Loader2} title="正在加载课程" spinning />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-brand" />
            <h1 className="text-2xl font-semibold tracking-normal">数据洞察</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            课程范围内的完成、掌握、共性问题和教学建议诊断
          </p>
        </div>
        {diagnosis && (
          <span className="text-xs text-muted-foreground">
            最后计算 {formatDateTime(diagnosis.scope.generatedAt)}
            {recomputeJob && ` · ${jobStatusLabel(recomputeJob)}`}
          </span>
        )}
      </div>

      <InsightsFilterBar
        courses={courses}
        diagnosis={diagnosis}
        coursesLoading={coursesLoading}
        searchParams={searchParams}
        recomputeJob={recomputeJob}
        recomputeStarting={recomputeStarting}
        scopeTags={scopeTags}
        onReplaceQuery={replaceQuery}
        onReset={resetFilters}
        onStartRecompute={startRecompute}
      />

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
          <DataQualityPanel flags={diagnosis.dataQualityFlags ?? []} />

          <KpiRow diagnosis={diagnosis} onKpiClick={openRiskDrawer} />

          <InsightsGrid
            diagnosis={diagnosis}
            scopeInsights={scopeInsights}
            scopeInsightsLoading={scopeInsightsLoading}
            scopeInsightsRefreshing={scopeInsightsRefreshing}
            onRefreshScopeInsights={refreshScopeInsights}
            studentNamesById={studentNamesById}
            onBinClick={(bin, classId) => {
              console.log("score-distribution click", { bin: bin.label, classId });
            }}
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
    </div>
  );
}

function DataQualityPanel({ flags }: { flags: DataQualityFlag[] }) {
  if (flags.length === 0) return null;
  const criticalCount = flags.filter((flag) => flag.severity === "critical").length;
  const warningCount = flags.filter((flag) => flag.severity === "warning").length;
  const topFlags = [...flags].sort(compareDataQualityFlag).slice(0, 5);
  return (
    <Card className="rounded-lg border-amber-200 bg-amber-50/50">
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-700" />
            <div className="font-medium">数据质量提示</div>
            <Badge variant="outline" className="rounded-md border-amber-300 bg-background">
              {flags.length} 项
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            严重 {criticalCount} · 需核对 {warningCount} · 信息 {flags.length - criticalCount - warningCount}
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {topFlags.map((flag) => (
            <div key={flag.id} className="rounded-md border bg-background px-3 py-2" title={flag.detail}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-sm font-medium">{flag.title}</div>
                <Badge variant={flag.severity === "critical" ? "destructive" : "outline"} className="shrink-0 rounded-md">
                  {dataQualitySeverityLabel(flag.severity)}
                </Badge>
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {flag.entityLabel ? `${flag.entityLabel}：` : ""}
                {flag.detail}
              </div>
              {flag.rawValue && <div className="mt-1 text-xs text-amber-700">原始值：{flag.rawValue}</div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


function InsightsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="正在生成诊断">
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-lg border bg-muted/30"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[280px] animate-pulse rounded-lg border bg-muted/30"
          />
        ))}
      </div>
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
    <Card className="rounded-lg">
      <CardContent className="flex min-h-[320px] flex-col items-center justify-center text-center">
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

function jobStatusLabel(job: AsyncJobSnapshot) {
  if (job.status === "queued") return "等待重算";
  if (job.status === "running") return `重算中 ${job.progress}%`;
  if (job.status === "succeeded") return `重算完成${job.completedAt ? ` ${formatDateTime(job.completedAt)}` : ""}`;
  if (job.status === "failed") return `重算失败：${job.error ?? "未知错误"}`;
  return "重算已取消";
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

