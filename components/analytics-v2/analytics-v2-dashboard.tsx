"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  ListChecks,
  Loader2,
  Target,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InsightsFilterBar } from "@/components/analytics-v2/insights-filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const INTERVENTION_LABELS: Record<AnalyticsV2Diagnosis["studentInterventions"][number]["reason"], string> = {
  not_submitted: "未完成",
  low_score: "低掌握",
  declining: "退步",
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
  const lowMasteryCount = useMemo(() => {
    if (!diagnosis) return 0;
    return new Set(
      diagnosis.studentInterventions
        .filter((item) => item.reason === "low_score")
        .map((item) => item.studentId),
    ).size;
  }, [diagnosis]);
  const pendingGrading = diagnosis
    ? Math.max(0, diagnosis.kpis.submittedStudents - diagnosis.kpis.gradedStudents)
    : 0;
  const riskChapterCount = diagnosis
    ? diagnosis.chapterDiagnostics.filter(
        (chapter) =>
          (chapter.completionRate !== null && chapter.completionRate < 0.6) ||
          (chapter.avgNormalizedScore !== null && chapter.avgNormalizedScore < 60),
      ).length
    : 0;

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

  if (coursesLoading) {
    return <CenteredState icon={Loader2} title="正在加载课程" spinning />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-brand" />
            <h1 className="text-2xl font-semibold tracking-normal">数据洞察 V2</h1>
            <Badge variant="outline">实验</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            课程范围内的完成、掌握、题目和干预诊断
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
          description={courses.length === 0 ? "创建课程并发布任务实例后，可在这里查看数据洞察。" : "课程是数据洞察 V2 的必选范围。"}
        />
      ) : error ? (
        <CenteredState icon={AlertCircle} title={error} />
      ) : diagnosisLoading && !diagnosis ? (
        <CenteredState icon={Loader2} title="正在生成诊断" spinning />
      ) : diagnosis ? (
        <>
          <DataQualityPanel flags={diagnosis.dataQualityFlags ?? []} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              icon={CheckCircle2}
              label="完成率"
              value={formatRate(diagnosis.kpis.completionRate)}
              sub={`${diagnosis.kpis.submittedStudents}/${diagnosis.kpis.assignedStudents} 人次`}
              warning={hasQualityCategory(diagnosis.dataQualityFlags, ["assignment", "aggregation"])}
            />
            <KpiCard
              icon={Target}
              label="归一化均分"
              value={formatPercentNumber(diagnosis.kpis.avgNormalizedScore)}
              sub={`中位数 ${formatPercentNumber(diagnosis.kpis.medianNormalizedScore)}`}
              warning={hasQualityCategory(diagnosis.dataQualityFlags, ["score"])}
            />
            <KpiCard icon={TrendingDown} label="低掌握人数" value={String(lowMasteryCount)} sub="按学生去重" />
            <KpiCard icon={Clock3} label="待批改" value={String(pendingGrading)} sub={`${diagnosis.kpis.submissionCount} 次提交`} />
            <KpiCard icon={AlertCircle} label="风险章节" value={String(riskChapterCount)} sub={`${diagnosis.kpis.instanceCount} 个实例`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Heatmap rows={diagnosis.chapterClassHeatmap} />
            <ActionList items={diagnosis.actionItems} />
          </div>

          <Tabs defaultValue="overview" className="space-y-3">
            <div className="overflow-x-auto pb-1">
              <TabsList className="h-9 w-max">
                <TabsTrigger value="overview">课程总览</TabsTrigger>
                <TabsTrigger value="chapters">章节诊断</TabsTrigger>
                <TabsTrigger value="instances">测试实例</TabsTrigger>
                <TabsTrigger value="quiz">测验题库</TabsTrigger>
                <TabsTrigger value="rubric">模拟/主观题</TabsTrigger>
                <TabsTrigger value="students">学生干预</TabsTrigger>
                <TabsTrigger value="weekly">AI 周洞察</TabsTrigger>
                <TabsTrigger value="trends">长期趋势</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview">
              <OverviewTab diagnosis={diagnosis} />
            </TabsContent>
            <TabsContent value="chapters">
              <ChapterTab diagnosis={diagnosis} />
            </TabsContent>
            <TabsContent value="instances">
              <InstanceTab diagnosis={diagnosis} />
            </TabsContent>
            <TabsContent value="quiz">
              <QuizTab rows={diagnosis.quizDiagnostics} />
            </TabsContent>
            <TabsContent value="rubric">
              <RubricTab rows={diagnosis.simulationDiagnostics} />
            </TabsContent>
            <TabsContent value="students">
              <StudentInterventionTab rows={diagnosis.studentInterventions} />
            </TabsContent>
            <TabsContent value="weekly">
              <WeeklyInsightTab insight={diagnosis.weeklyInsight} />
            </TabsContent>
            <TabsContent value="trends">
              <TrendsTab diagnosis={diagnosis} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  warning = false,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  sub: string;
  warning?: boolean;
}) {
  return (
    <Card className={cn("rounded-lg py-4", warning && "border-amber-200 bg-amber-50/40")}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            {warning && (
              <Badge variant="outline" className="rounded-md border-amber-300 bg-amber-50 text-amber-800">
                需核对
              </Badge>
            )}
          </div>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-normal">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
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

function Heatmap({ rows }: { rows: AnalyticsV2Diagnosis["chapterClassHeatmap"] }) {
  const chapters = Array.from(new Set(rows.map((row) => row.chapterTitle)));
  const classes = Array.from(new Set(rows.map((row) => row.className)));
  const rowMap = new Map(rows.map((row) => [`${row.chapterTitle}::${row.className}`, row]));

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">章节 × 班级热力图</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyInline text="当前范围暂无章节班级数据" />
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[620px] gap-1 text-xs"
              style={{ gridTemplateColumns: `160px repeat(${classes.length}, minmax(118px, 1fr))` }}
            >
              <div className="py-2 font-medium text-muted-foreground">章节</div>
              {classes.map((className) => (
                <div key={className} className="py-2 font-medium text-muted-foreground">
                  {className}
                </div>
              ))}
              {chapters.map((chapter) => (
                <div key={chapter} className="contents">
                  <div className="truncate rounded-md bg-muted/40 px-2 py-3 font-medium">{chapter}</div>
                  {classes.map((className) => {
                    const cell = rowMap.get(`${chapter}::${className}`);
                    const score = cell?.avgNormalizedScore ?? null;
                    const needsReview = isAbnormalMetric(score, "percent") || isAbnormalMetric(cell?.completionRate ?? null, "rate");
                    return (
                      <div
                        key={`${chapter}-${className}`}
                        className={cn(
                          "rounded-md border px-2 py-2",
                          heatClass(score, cell?.completionRate ?? null),
                          needsReview && "border-amber-300 bg-amber-50 text-amber-950",
                        )}
                        title={needsReview ? "该格子存在超过常规范围的原始数值，请查看数据质量提示。" : undefined}
                      >
                        <div className="flex items-center gap-1 font-semibold">
                          {formatPercentNumber(score)}
                          {needsReview && <span className="text-[10px] text-amber-700">需核对</span>}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          完成 {formatRate(cell?.completionRate ?? null)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionList({ items }: { items: AnalyticsV2Diagnosis["actionItems"] }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4" />
          行动清单
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyInline text="当前范围暂无高优先级行动" />
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={item.severity === "high" ? "destructive" : "secondary"} className="rounded-md">
                    {item.severity === "high" ? "高" : "中"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{actionMetric(item)}</span>
                </div>
                <div className="mt-2 text-sm font-medium leading-5">{item.title}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">课程总览</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>章节</TableHead>
              <TableHead>实例</TableHead>
              <TableHead>完成率</TableHead>
              <TableHead>均分</TableHead>
              <TableHead>弱点</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diagnosis.chapterDiagnostics.map((chapter) => (
              <TableRow key={chapter.chapterId ?? "unassigned"}>
                <TableCell className="font-medium">{chapter.title}</TableCell>
                <TableCell>{chapter.instanceCount}</TableCell>
                <TableCell>{formatRate(chapter.completionRate)}</TableCell>
                <TableCell>{formatPercentNumber(chapter.avgNormalizedScore)}</TableCell>
                <TableCell>
                  <WeaknessBadges weaknesses={chapter.weaknesses} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ChapterTab({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">章节诊断</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnosis.chapterDiagnostics.map((chapter) => {
          const modeSplit = buildModeSplit(diagnosis.instanceDiagnostics, chapter.chapterId);
          return (
            <div key={chapter.chapterId ?? "unassigned"} className="rounded-md border p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{chapter.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {chapter.submittedStudents}/{chapter.assignedStudents} 人次完成 · {chapter.instanceCount} 个实例
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {modeSplit.map((item) => (
                    <Badge key={item.type} variant="outline" className="rounded-md">
                      {TASK_TYPE_LABELS[item.type]} {item.count}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <MetricBar label="完成率" value={chapter.completionRate} />
                <MetricBar label="章节掌握度" value={chapter.avgNormalizedScore === null ? null : chapter.avgNormalizedScore / 100} />
              </div>
              <div className="mt-3">
                <WeaknessBadges weaknesses={chapter.weaknesses} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function InstanceTab({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">测试实例</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>实例</TableHead>
              <TableHead>模式</TableHead>
              <TableHead>班级</TableHead>
              <TableHead>应提交人次</TableHead>
              <TableHead>已提交人次</TableHead>
              <TableHead>完成率</TableHead>
              <TableHead>均分</TableHead>
              <TableHead>中位数</TableHead>
              <TableHead>通过率</TableHead>
              <TableHead>弱点</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diagnosis.instanceDiagnostics.map((instance) => (
              <TableRow key={instance.instanceId}>
                <TableCell className="max-w-[220px] truncate font-medium">{instance.title}</TableCell>
                <TableCell>{TASK_TYPE_LABELS[instance.taskType]}</TableCell>
                <TableCell>{instance.className}</TableCell>
                <TableCell>{instance.assignedStudents}</TableCell>
                <TableCell>{instance.submittedStudents}</TableCell>
                <TableCell>{formatRate(instance.completionRate)}</TableCell>
                <TableCell>{formatPercentNumber(instance.avgNormalizedScore)}</TableCell>
                <TableCell>{formatPercentNumber(instance.medianNormalizedScore)}</TableCell>
                <TableCell>{formatRate(instance.passRate)}</TableCell>
                <TableCell>
                  <WeaknessBadges weaknesses={instance.weaknesses} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function QuizTab({ rows }: { rows: AnalyticsV2Diagnosis["quizDiagnostics"] }) {
  if (rows.length === 0) return <PlaceholderTab title="测验题库" description="当前范围没有可聚合的题目作答明细或题目元数据。" />;
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">测验题目诊断</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>题目</TableHead>
              <TableHead>正确率</TableHead>
              <TableHead>未答率</TableHead>
              <TableHead>得分率</TableHead>
              <TableHead>弱点标签</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.questionId}>
                <TableCell className="max-w-[420px]">
                  <div className="text-xs text-muted-foreground">Q{row.order}</div>
                  <div className="line-clamp-2 font-medium">{row.prompt}</div>
                </TableCell>
                <TableCell>{formatRate(row.correctRate)}</TableCell>
                <TableCell>{formatRate(row.unansweredRate)}</TableCell>
                <TableCell>{formatPercentNumber(row.avgScoreRate)}</TableCell>
                <TableCell>
                  <TagList tags={row.weakTags} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RubricTab({ rows }: { rows: AnalyticsV2Diagnosis["simulationDiagnostics"] }) {
  if (rows.length === 0) return <PlaceholderTab title="模拟/主观题" description="当前范围没有可聚合的评分明细或评分维度元数据。" />;
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">评分维度诊断</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>维度</TableHead>
              <TableHead>平均得分率</TableHead>
              <TableHead>低分人数</TableHead>
              <TableHead>学生</TableHead>
              <TableHead>样例评语</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.criterionId}>
                <TableCell className="font-medium">{row.criterionName}</TableCell>
                <TableCell>{formatPercentNumber(row.avgScoreRate)}</TableCell>
                <TableCell>{row.lowScoreCount}</TableCell>
                <TableCell>
                  <TagList tags={row.weakStudents.map((student) => student.studentName)} />
                </TableCell>
                <TableCell className="max-w-[340px] truncate text-muted-foreground">
                  {row.sampleComments[0] ?? "无"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StudentInterventionTab({ rows }: { rows: AnalyticsV2Diagnosis["studentInterventions"] }) {
  if (rows.length === 0) return <PlaceholderTab title="学生干预" description="当前范围没有未完成、低掌握或退步学生。" />;
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">学生干预</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>学生</TableHead>
              <TableHead>班级</TableHead>
              <TableHead>实例</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>得分</TableHead>
              <TableHead>最好</TableHead>
              <TableHead>变化</TableHead>
              <TableHead>尝试</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.studentId}-${row.instanceTitle}-${index}`}>
                <TableCell className="font-medium">{row.studentName}</TableCell>
                <TableCell>{row.className}</TableCell>
                <TableCell className="max-w-[260px] truncate">{row.instanceTitle}</TableCell>
                <TableCell>
                  <Badge variant={row.reason === "not_submitted" ? "outline" : "secondary"} className="rounded-md">
                    {INTERVENTION_LABELS[row.reason]}
                  </Badge>
                </TableCell>
                <TableCell>{formatPercentNumber(row.selectedScore)}</TableCell>
                <TableCell>{formatPercentNumber(row.bestScore)}</TableCell>
                <TableCell>{row.improvement === null ? "无" : `${row.improvement > 0 ? "+" : ""}${row.improvement}pp`}</TableCell>
                <TableCell>{row.attemptCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WeeklyInsightTab({ insight }: { insight: AnalyticsV2Diagnosis["weeklyInsight"] }) {
  return (
    <div className="space-y-3">
      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">AI 周洞察</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-md">
                {insight.label}
              </Badge>
              <span className="text-xs text-muted-foreground">生成时间 {formatDateTime(insight.generatedAt)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <InsightColumn title="高亮摘要" items={insight.highlights} emptyText="当前范围暂无可汇总的高亮。" />
          <InsightColumn title="风险" items={insight.risks} emptyText="当前范围暂无明显风险。" />
          <InsightColumn title="下一步建议" items={insight.recommendations} emptyText="当前范围暂无建议。" />
        </CardContent>
      </Card>
    </div>
  );
}

function InsightColumn({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: InsightItem[];
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      {items.length === 0 ? (
        <EmptyInline text={emptyText} />
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium leading-5">{item.title}</div>
              <Badge variant={insightBadgeVariant(item.severity)} className="shrink-0 rounded-md">
                {insightSeverityLabel(item.severity)}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            <div className="mt-2 text-xs text-muted-foreground">依据：{item.evidence}</div>
          </div>
        ))
      )}
    </div>
  );
}

function TrendsTab({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  const { trends } = diagnosis;
  const hasData =
    trends.chapterTrend.length > 0 ||
    trends.classTrend.length > 0 ||
    trends.studentGrowth.length > 0;
  if (!hasData) {
    return <PlaceholderTab title="长期趋势" description="当前时间范围内暂无可展示的章节、班级或学生成长趋势。" />;
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">章节趋势</CardTitle>
            <span className="text-xs text-muted-foreground">
              {RANGE_LABELS[trends.range]} · 更新 {formatDateTime(trends.generatedAt)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {trends.chapterTrend.length === 0 ? (
            <EmptyInline text="当前范围暂无章节趋势数据" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>章节</TableHead>
                  <TableHead>实例</TableHead>
                  <TableHead>完成率</TableHead>
                  <TableHead>章节掌握度</TableHead>
                  <TableHead>最近活动</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends.chapterTrend.map((row) => (
                  <TableRow key={row.chapterId ?? "unassigned"}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.instanceCount}</TableCell>
                    <TableCell>
                      <TrendMetric value={row.completionRate} kind="rate" />
                    </TableCell>
                    <TableCell>
                      <TrendMetric value={row.avgNormalizedScore} kind="percent" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.latestActivityAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">班级趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.classTrend.length === 0 ? (
            <EmptyInline text="当前范围暂无班级趋势数据" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>班级</TableHead>
                  <TableHead>实例</TableHead>
                  <TableHead>完成</TableHead>
                  <TableHead>完成率</TableHead>
                  <TableHead>均分</TableHead>
                  <TableHead>最近活动</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends.classTrend.map((row) => (
                  <TableRow key={row.classId}>
                    <TableCell className="font-medium">{row.className}</TableCell>
                    <TableCell>{row.instanceCount}</TableCell>
                    <TableCell>{row.submittedStudents}/{row.assignedStudents}</TableCell>
                    <TableCell>
                      <TrendMetric value={row.completionRate} kind="rate" />
                    </TableCell>
                    <TableCell>
                      <TrendMetric value={row.avgNormalizedScore} kind="percent" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.latestActivityAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">学生成长</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.studentGrowth.length === 0 ? (
            <EmptyInline text="当前范围暂无学生成长数据" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead>当前得分</TableHead>
                  <TableHead>最好</TableHead>
                  <TableHead>变化</TableHead>
                  <TableHead>尝试</TableHead>
                  <TableHead>完成实例</TableHead>
                  <TableHead>最近提交</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends.studentGrowth.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell className="font-medium">{row.studentName}</TableCell>
                    <TableCell>{row.className}</TableCell>
                    <TableCell>{formatPercentNumber(row.selectedScore)}</TableCell>
                    <TableCell>{formatPercentNumber(row.bestScore)}</TableCell>
                    <TableCell>{formatPointChange(row.improvement)}</TableCell>
                    <TableCell>{row.attemptCount}</TableCell>
                    <TableCell>{row.completedInstances}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.latestSubmittedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrendMetric({ value, kind }: { value: number | null; kind: "rate" | "percent" }) {
  const rawProgressValue = value === null ? 0 : kind === "rate" ? value * 100 : value;
  const needsReview = isAbnormalMetric(value, kind);
  return (
    <div className="min-w-[120px] space-y-1">
      <div className="flex items-center gap-1 text-sm">
        {kind === "rate" ? formatRate(value) : formatPercentNumber(value)}
        {needsReview && <span className="text-[10px] text-amber-700">需核对</span>}
      </div>
      <Progress value={clampProgress(rawProgressValue)} />
    </div>
  );
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
        <BarChart3 className="size-8 text-muted-foreground" />
        <div className="mt-3 font-medium">{title}</div>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
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

function MetricBar({ label, value }: { label: string; value: number | null }) {
  const rawProgressValue = value === null ? 0 : value * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", isAbnormalMetric(value, "rate") && "text-amber-700")}>
          {formatRate(value)}
        </span>
      </div>
      <Progress value={clampProgress(rawProgressValue)} />
    </div>
  );
}

function WeaknessBadges({ weaknesses }: { weaknesses: Array<{ tag: string; count: number }> }) {
  if (weaknesses.length === 0) return <span className="text-xs text-muted-foreground">无明显弱点</span>;
  return <TagList tags={weaknesses.slice(0, 4).map((weakness) => `${weakness.tag} ${weakness.count}`)} />;
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-xs text-muted-foreground">无</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, 5).map((tag) => (
        <Badge key={tag} variant="outline" className="rounded-md">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">{text}</div>;
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

function buildModeSplit(rows: AnalyticsV2Diagnosis["instanceDiagnostics"], chapterId: string | null) {
  const counts = new Map<TaskType, number>();
  for (const row of rows) {
    if ((row.chapterId ?? null) !== (chapterId ?? null)) continue;
    counts.set(row.taskType, (counts.get(row.taskType) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
}

function heatClass(score: number | null, completion: number | null) {
  if (score === null && completion === null) return "bg-muted/30";
  const metric = score ?? (completion === null ? null : completion * 100);
  if (metric === null) return "bg-muted/30";
  if (metric >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (metric >= 60) return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-rose-200 bg-rose-50 text-rose-950";
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function isAbnormalMetric(value: number | null | undefined, kind: "rate" | "percent") {
  if (value === null || value === undefined) return false;
  if (!Number.isFinite(value)) return true;
  if (kind === "rate") return value < 0 || value > 1;
  return value < 0 || value > 100;
}

function hasQualityCategory(flags: DataQualityFlag[] | undefined, categories: DataQualityFlag["category"][]) {
  if (!flags) return false;
  return flags.some((flag) => flag.severity !== "info" && categories.includes(flag.category));
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

function actionMetric(item: AnalyticsV2Diagnosis["actionItems"][number]) {
  if (item.type === "low_completion") return formatRate(item.metric);
  if (item.type === "low_score") return formatPercentNumber(item.metric);
  return `${item.metric} 人次`;
}

function insightBadgeVariant(severity: InsightItem["severity"]) {
  if (severity === "high") return "destructive";
  if (severity === "medium") return "secondary";
  return "outline";
}

function insightSeverityLabel(severity: InsightItem["severity"]) {
  if (severity === "high") return "高";
  if (severity === "medium") return "中";
  return "提示";
}

function formatPointChange(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}pp`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatPercentNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 10) / 10}%`;
}
