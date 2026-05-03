"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Info,
  LineChart,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type TaskType = "simulation" | "quiz" | "subjective";
type ScorePolicy = "latest" | "best" | "first";
type RangeValue = "7d" | "30d" | "term" | "custom";
type ScoreBinMode = "standard" | "ten";
type LayoutVariant = "overview" | "charts";

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
    classId: string | null;
    taskType: TaskType | null;
    taskInstanceId: string | null;
    scorePolicy: ScorePolicy;
    range: RangeValue;
    dateFrom: string | null;
    dateTo: string | null;
    scoreBins: ScoreBinMode;
    generatedAt: string;
  };
  filterOptions: {
    classes: Array<{ id: string; name: string }>;
    chapters: Array<{ id: string; title: string; order: number }>;
    sections: Array<{ id: string; title: string; chapterId: string; order: number }>;
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
  generatedAt: string;
  kpis: {
    instanceCount: number;
    assignedStudents: number;
    submittedStudents: number;
    gradedStudents: number;
    submissionCount: number;
    attemptCount: number;
    pendingReleaseCount: number;
    riskChapterCount: number;
    riskStudentCount: number;
    completionRate: number | null;
    avgNormalizedScore: number | null;
    medianNormalizedScore: number | null;
    passRate: number | null;
  };
  scoreDistribution: {
    mode: ScoreBinMode;
    bins: Array<{
      id: string;
      label: string;
      min: number;
      max: number;
      count: number;
      students: Array<{
        studentId: string;
        studentName: string;
        classId: string;
        className: string;
        score: number | null;
        completedInstances: number;
        attemptCount: number;
        contributions: Array<{
          instanceId: string;
          instanceTitle: string;
          taskType: TaskType;
          score: number | null;
          submittedAt: string | null;
        }>;
      }>;
    }>;
  };
  taskPerformance: {
    mode: "scope" | "single";
    selectedInstanceId: string | null;
    taskComparisons: Array<{
      instanceId: string;
      title: string;
      taskType: TaskType;
      className: string;
      chapterTitle: string | null;
      sectionTitle: string | null;
      completionRate: number | null;
      avgNormalizedScore: number | null;
      pendingReleaseCount: number;
      riskLevel: "low" | "medium" | "high";
    }>;
    highExamples: EvidenceSummary[];
    lowIssues: Array<{
      id: string;
      title: string;
      detail: string;
      metric: number | null;
      evidence: EvidenceSummary[];
    }>;
  };
  studyBuddySignals: {
    totalQuestions: number;
    pendingQuestions: number;
    activeStudents: number;
    groups: Array<{
      id: string;
      chapterTitle: string;
      sectionTitle: string;
      taskTitle: string;
      taskType: TaskType;
      questionCount: number;
      pendingCount: number;
      studentCount: number;
      topQuestions: Array<{ question: string; count: number; examples: string[] }>;
      students: Array<{ id: string; name: string; count: number }>;
    }>;
  };
  risks: {
    chapters: Array<{
      chapterId: string | null;
      title: string;
      completionRate: number | null;
      avgNormalizedScore: number | null;
      reasons: string[];
      instances: Array<{ instanceId: string; title: string; taskType: TaskType; className: string }>;
    }>;
    students: Array<{
      studentId: string;
      studentName: string;
      className: string;
      reasons: Array<"not_submitted" | "low_score" | "declining">;
      selectedScore: number | null;
      improvement: number | null;
      affectedInstances: Array<{ instanceId: string; title: string; reason: string; score: number | null }>;
    }>;
    pendingReleases: Array<{
      submissionId: string;
      studentName: string;
      instanceTitle: string;
      taskType: TaskType;
      className: string;
      score: number | null;
      maxScore: number | null;
      submittedAt: string | null;
    }>;
  };
  dataQualityFlags: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
    entityLabel?: string | null;
    rawValue?: string | null;
  }>;
}

interface EvidenceSummary {
  id: string;
  submissionId: string;
  studentName: string;
  score: number | null;
  maxScore: number | null;
  normalizedScore: number | null;
  evidenceKind: TaskType;
  title: string;
  excerpt: string;
}

interface AsyncJobSnapshot {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
  result?: unknown;
  error?: string | null;
  completedAt?: string | null;
}

interface DataInsightAdvice {
  generatedAt: string;
  fingerprint: string;
  summary: string;
  knowledgeGoals: string[];
  teachingMethods: string[];
  focusGroups: string[];
  nextActions: string[];
  evidenceRefs: Array<{ id: string; label: string; detail: string }>;
}

type DetailSheet =
  | { type: "distribution"; title: string; bin: AnalyticsV2Diagnosis["scoreDistribution"]["bins"][number] }
  | { type: "completion"; title: string }
  | { type: "score"; title: string }
  | { type: "pending"; title: string }
  | { type: "risk"; title: string }
  | null;

const ALL = "__all__";

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  simulation: "模拟",
  quiz: "测验",
  subjective: "主观",
};

const RANGE_LABELS: Record<RangeValue, string> = {
  term: "本学期",
  "30d": "近 30 天",
  "7d": "近 7 天",
  custom: "自定义",
};

const BIN_LABELS: Record<ScoreBinMode, string> = {
  standard: "常用段位",
  ten: "10 分档",
};

const REASON_LABELS: Record<"not_submitted" | "low_score" | "declining", string> = {
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
  const [error, setError] = useState<string | null>(null);
  const [detailSheet, setDetailSheet] = useState<DetailSheet>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidence, setEvidence] = useState<Record<string, unknown> | null>(null);
  const [adviceJob, setAdviceJob] = useState<AsyncJobSnapshot | null>(null);
  const [advice, setAdvice] = useState<DataInsightAdvice | null>(null);
  const [adviceStarting, setAdviceStarting] = useState(false);

  const courseId = searchParams.get("courseId") ?? "";
  const chapterId = searchParams.get("chapterId") ?? "";
  const sectionId = searchParams.get("sectionId") ?? "";
  const classId = searchParams.get("classId") ?? "";
  const taskInstanceId = searchParams.get("taskInstanceId") ?? "";
  const range = (searchParams.get("range") ?? "term") as RangeValue;
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const scoreBins = (searchParams.get("scoreBins") ?? "standard") as ScoreBinMode;
  const layout = searchParams.get("layout") === "charts" ? "charts" : "overview";

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
          setAdvice(null);
          setAdviceJob(null);
        } else {
          setDiagnosis(null);
          setError(json.error?.message ?? "加载数据洞察失败");
        }
      } catch {
        if (!controller.signal.aborted) {
          setDiagnosis(null);
          setError("加载数据洞察失败");
        }
      } finally {
        if (!controller.signal.aborted) setDiagnosisLoading(false);
      }
    }
    fetchDiagnosis();
    return () => controller.abort();
  }, [courseId, searchParams]);

  useEffect(() => {
    if (!adviceJob || !isJobRunning(adviceJob)) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/async-jobs/${adviceJob.id}`, { cache: "no-store" });
        const json = await res.json();
        if (!json.success) return;
        const job = json.data as AsyncJobSnapshot;
        setAdviceJob(job);
        if (job.status === "succeeded" && isAdvice(job.result)) {
          setAdvice(job.result);
        }
      } catch {
        // Keep polling; transient network failures should not discard the job.
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [adviceJob]);

  const filteredSections = useMemo(() => {
    const sections = diagnosis?.filterOptions.sections ?? [];
    return chapterId ? sections.filter((section) => section.chapterId === chapterId) : sections;
  }, [chapterId, diagnosis]);

  const filteredInstances = useMemo(() => {
    return (diagnosis?.filterOptions.taskInstances ?? []).filter((instance) => {
      if (chapterId && instance.chapterId !== chapterId) return false;
      if (sectionId && instance.sectionId !== sectionId) return false;
      if (classId && instance.classId !== classId) return false;
      return true;
    });
  }, [chapterId, classId, diagnosis, sectionId]);

  function replaceQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    const next = new URLSearchParams();
    if (courseId) next.set("courseId", courseId);
    next.set("layout", layout);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  async function openEvidence(summary: EvidenceSummary) {
    setEvidenceOpen(true);
    setEvidenceLoading(true);
    setEvidence(null);
    try {
      const res = await fetch(`/api/lms/analytics-v2/evidence?submissionId=${summary.submissionId}&kind=${summary.evidenceKind}`);
      const json = await res.json();
      if (json.success) setEvidence(json.data);
      else setError(json.error?.message ?? "加载证据失败");
    } catch {
      setError("加载证据失败");
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function startAdvice() {
    if (!courseId || adviceStarting || isJobRunning(adviceJob)) return;
    setAdviceStarting(true);
    setError(null);
    try {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/lms/analytics-v2/advice?${params.toString()}`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "启动 AI 建议失败");
        return;
      }
      setAdviceJob(json.data.job);
      if (json.data.cachedAdvice) setAdvice(json.data.cachedAdvice);
    } catch {
      setError("启动 AI 建议失败");
    } finally {
      setAdviceStarting(false);
    }
  }

  if (coursesLoading) return <CenteredState icon={Loader2} title="正在加载课程" spinning />;

  return (
    <div className="space-y-4">
      <AnalyticsHeader
        diagnosis={diagnosis}
        layout={layout}
        onLayoutChange={(nextLayout) => replaceQuery({ layout: nextLayout })}
        onGenerateAdvice={startAdvice}
        adviceBusy={adviceStarting || isJobRunning(adviceJob)}
        adviceProgress={adviceJob?.progress ?? 0}
        onReset={resetFilters}
        canReset={Boolean(courseId)}
      />

      <FilterBar
        courses={courses}
        diagnosis={diagnosis}
        values={{ courseId, classId, chapterId, sectionId, taskInstanceId, range, dateFrom, dateTo }}
        filteredSections={filteredSections}
        filteredInstances={filteredInstances}
        onChange={replaceQuery}
      />

      {!courseId ? (
        <CenteredState icon={Target} title={courses.length === 0 ? "暂无可分析课程" : "请选择课程"} />
      ) : error ? (
        <CenteredState icon={AlertCircle} title={error} />
      ) : diagnosisLoading && !diagnosis ? (
        <CenteredState icon={Loader2} title="正在生成数据洞察" spinning />
      ) : diagnosis ? (
        <>
          <DataQualityPanel flags={diagnosis.dataQualityFlags} />
          {layout === "charts" ? (
            <ChartsLayout
              diagnosis={diagnosis}
              scoreBins={scoreBins}
              advice={advice}
              adviceJob={adviceJob}
              adviceDisabled={adviceStarting || isJobRunning(adviceJob)}
              onModeChange={(mode) => replaceQuery({ scoreBins: mode })}
              onOpenDetail={setDetailSheet}
              onOpenBin={(bin) => setDetailSheet({ type: "distribution", title: `${bin.label} 分学生`, bin })}
              onSelectTask={(id) => replaceQuery({ taskInstanceId: id })}
              onEvidence={openEvidence}
              onGenerateAdvice={startAdvice}
            />
          ) : (
            <OverviewLayout
              diagnosis={diagnosis}
              scoreBins={scoreBins}
              advice={advice}
              adviceJob={adviceJob}
              adviceDisabled={adviceStarting || isJobRunning(adviceJob)}
              onModeChange={(mode) => replaceQuery({ scoreBins: mode })}
              onOpenDetail={setDetailSheet}
              onOpenBin={(bin) => setDetailSheet({ type: "distribution", title: `${bin.label} 分学生`, bin })}
              onSelectTask={(id) => replaceQuery({ taskInstanceId: id })}
              onEvidence={openEvidence}
              onGenerateAdvice={startAdvice}
            />
          )}
        </>
      ) : null}

      <DetailSheetView diagnosis={diagnosis} detail={detailSheet} onClose={() => setDetailSheet(null)} />
      <EvidenceSheet open={evidenceOpen} loading={evidenceLoading} data={evidence} onOpenChange={setEvidenceOpen} />
    </div>
  );
}

function AnalyticsHeader({
  diagnosis,
  layout,
  adviceBusy,
  adviceProgress,
  canReset,
  onLayoutChange,
  onGenerateAdvice,
  onReset,
}: {
  diagnosis: AnalyticsV2Diagnosis | null;
  layout: LayoutVariant;
  adviceBusy: boolean;
  adviceProgress: number;
  canReset: boolean;
  onLayoutChange: (layout: LayoutVariant) => void;
  onGenerateAdvice: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-brand" />
          <h1 className="text-2xl font-semibold tracking-normal">数据洞察</h1>
          <Badge variant="outline" className="rounded-full px-2 font-normal">
            {layout === "overview" ? "方案 A · 单屏总览" : "方案 B · 图表诊断"}
          </Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {diagnosis ? `${diagnosis.scope.courseTitle} · 更新 ${formatDateTime(diagnosis.generatedAt)}` : "选择课程后查看完成、成绩、问题与教学建议"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-background p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onLayoutChange("overview")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              layout === "overview" ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            方案 A
          </button>
          <button
            type="button"
            onClick={() => onLayoutChange("charts")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              layout === "charts" ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            方案 B
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerateAdvice} disabled={!diagnosis || adviceBusy}>
          {adviceBusy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
          {adviceBusy ? `AI ${adviceProgress}%` : "生成建议"}
        </Button>
        <Button variant="outline" size="sm" onClick={onReset} disabled={!canReset}>
          <RefreshCw className="mr-2 size-3.5" />
          重置
        </Button>
      </div>
    </div>
  );
}

function OverviewLayout({
  diagnosis,
  scoreBins,
  advice,
  adviceJob,
  adviceDisabled,
  onModeChange,
  onOpenDetail,
  onOpenBin,
  onSelectTask,
  onEvidence,
  onGenerateAdvice,
}: AnalyticsLayoutProps) {
  return (
    <div className="space-y-4">
      <KpiRow diagnosis={diagnosis} onOpen={onOpenDetail} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)_320px]">
        <ScoreDistributionCard
          diagnosis={diagnosis}
          scoreBins={scoreBins}
          density="compact"
          onModeChange={onModeChange}
          onOpenBin={onOpenBin}
        />
        <TaskPerformanceCard
          diagnosis={diagnosis}
          density="compact"
          onSelectTask={onSelectTask}
          onEvidence={onEvidence}
        />
        <StudyBuddyCard diagnosis={diagnosis} density="compact" />
      </div>
      <AiAdviceCard
        advice={advice}
        job={adviceJob}
        density="wide"
        onGenerate={onGenerateAdvice}
        disabled={adviceDisabled}
      />
    </div>
  );
}

function ChartsLayout({
  diagnosis,
  scoreBins,
  advice,
  adviceJob,
  adviceDisabled,
  onModeChange,
  onOpenDetail,
  onOpenBin,
  onSelectTask,
  onEvidence,
  onGenerateAdvice,
}: AnalyticsLayoutProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.45fr]">
          <KpiMiniCard
            icon={CheckCircle2}
            label="完成率"
            value={formatRate(diagnosis.kpis.completionRate)}
            sub={`${diagnosis.kpis.submittedStudents}/${diagnosis.kpis.assignedStudents} 人次`}
            onClick={() => onOpenDetail({ type: "completion", title: "完成风险" })}
          />
          <KpiMiniCard
            icon={TrendingUp}
            label="归一化均分"
            value={formatPercentNumber(diagnosis.kpis.avgNormalizedScore)}
            sub={`中位数 ${formatPercentNumber(diagnosis.kpis.medianNormalizedScore)}`}
            onClick={() => onOpenDetail({ type: "score", title: "成绩风险" })}
          />
          <KpiMiniCard
            icon={Clock3}
            label="成绩待发布"
            value={`${diagnosis.kpis.pendingReleaseCount}`}
            sub={`${diagnosis.kpis.gradedStudents} 份已批改`}
            onClick={() => onOpenDetail({ type: "pending", title: "成绩待发布" })}
          />
          <RiskSignalCard diagnosis={diagnosis} onOpen={() => onOpenDetail({ type: "risk", title: "风险章节与学生" })} />
        </div>
        <div className="grid gap-4">
          <ScoreDistributionCard
            diagnosis={diagnosis}
            scoreBins={scoreBins}
            density="chart"
            onModeChange={onModeChange}
            onOpenBin={onOpenBin}
          />
          <TaskPerformanceCard
            diagnosis={diagnosis}
            density="chart"
            onSelectTask={onSelectTask}
            onEvidence={onEvidence}
          />
        </div>
        <AiAdviceCard
          advice={advice}
          job={adviceJob}
          density="wide"
          onGenerate={onGenerateAdvice}
          disabled={adviceDisabled}
        />
      </div>
      <div className="space-y-4">
        <StudyBuddyCard diagnosis={diagnosis} density="chart" />
        <RiskListCard diagnosis={diagnosis} />
      </div>
    </div>
  );
}

interface AnalyticsLayoutProps {
  diagnosis: AnalyticsV2Diagnosis;
  scoreBins: ScoreBinMode;
  advice: DataInsightAdvice | null;
  adviceJob: AsyncJobSnapshot | null;
  adviceDisabled: boolean;
  onModeChange: (mode: ScoreBinMode) => void;
  onOpenDetail: (detail: DetailSheet) => void;
  onOpenBin: (bin: AnalyticsV2Diagnosis["scoreDistribution"]["bins"][number]) => void;
  onSelectTask: (id: string) => void;
  onEvidence: (summary: EvidenceSummary) => void;
  onGenerateAdvice: () => void;
}

function FilterBar({
  courses,
  diagnosis,
  values,
  filteredSections,
  filteredInstances,
  onChange,
}: {
  courses: CourseOption[];
  diagnosis: AnalyticsV2Diagnosis | null;
  values: {
    courseId: string;
    classId: string;
    chapterId: string;
    sectionId: string;
    taskInstanceId: string;
    range: RangeValue;
    dateFrom: string;
    dateTo: string;
  };
  filteredSections: AnalyticsV2Diagnosis["filterOptions"]["sections"];
  filteredInstances: AnalyticsV2Diagnosis["filterOptions"]["taskInstances"];
  onChange: (updates: Record<string, string | null>) => void;
}) {
  return (
    <Card className="rounded-xl border-border/70 bg-white/80 py-3 shadow-sm">
      <CardContent className="grid gap-2.5 px-3 md:grid-cols-2 xl:grid-cols-[1.25fr_0.8fr_1fr_1fr_1.35fr_0.85fr_0.9fr_0.9fr]">
        <FilterSelect
          label="课程"
          value={values.courseId || ALL}
          placeholder="选择课程"
          onChange={(courseId) => onChange({ courseId, classId: null, chapterId: null, sectionId: null, taskInstanceId: null })}
          options={courses.map((course) => ({
            value: course.id,
            label: course.class?.name ? `${course.courseTitle} · ${course.class.name}` : course.courseTitle,
          }))}
        />
        <FilterSelect
          label="班级"
          value={values.classId || ALL}
          disabled={!diagnosis}
          onChange={(classId) => onChange({ classId, taskInstanceId: null })}
          options={(diagnosis?.filterOptions.classes ?? []).map((klass) => ({ value: klass.id, label: klass.name }))}
        />
        <FilterSelect
          label="章"
          value={values.chapterId || ALL}
          disabled={!diagnosis}
          onChange={(chapterId) => onChange({ chapterId, sectionId: null, taskInstanceId: null })}
          options={(diagnosis?.filterOptions.chapters ?? []).map((chapter) => ({ value: chapter.id, label: `${chapter.order}. ${chapter.title}` }))}
        />
        <FilterSelect
          label="节"
          value={values.sectionId || ALL}
          disabled={!diagnosis}
          onChange={(sectionId) => onChange({ sectionId, taskInstanceId: null })}
          options={filteredSections.map((section) => ({ value: section.id, label: `${section.order}. ${section.title}` }))}
        />
        <FilterSelect
          label="任务"
          value={values.taskInstanceId || ALL}
          disabled={!diagnosis}
          onChange={(taskInstanceId) => onChange({ taskInstanceId })}
          options={filteredInstances.map((instance) => ({ value: instance.id, label: `${instance.title} · ${instance.className}` }))}
        />
        <FilterSelect
          label="时间"
          value={values.range}
          onChange={(range) => onChange({ range, dateFrom: range === "custom" ? values.dateFrom : null, dateTo: range === "custom" ? values.dateTo : null })}
          options={[
            { value: "term", label: RANGE_LABELS.term },
            { value: "30d", label: RANGE_LABELS["30d"] },
            { value: "7d", label: RANGE_LABELS["7d"] },
            { value: "custom", label: RANGE_LABELS.custom },
          ]}
        />
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">开始</span>
          <Input className="h-8 text-xs" type="date" value={values.dateFrom} disabled={values.range !== "custom"} onChange={(event) => onChange({ dateFrom: event.target.value, range: "custom" })} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">结束</span>
          <Input className="h-8 text-xs" type="date" value={values.dateTo} disabled={values.range !== "custom"} onChange={(event) => onChange({ dateTo: event.target.value, range: "custom" })} />
        </label>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder = "全部",
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-8 w-full rounded-md text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function KpiRow({ diagnosis, onOpen }: { diagnosis: AnalyticsV2Diagnosis; onOpen: (detail: DetailSheet) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={CheckCircle2}
        label="完成率"
        value={formatRate(diagnosis.kpis.completionRate)}
        sub={`${diagnosis.kpis.submittedStudents}/${diagnosis.kpis.assignedStudents} 人次`}
        onClick={() => onOpen({ type: "completion", title: "完成风险" })}
      />
      <KpiCard
        icon={Target}
        label="归一化均分"
        value={formatPercentNumber(diagnosis.kpis.avgNormalizedScore)}
        sub={`中位数 ${formatPercentNumber(diagnosis.kpis.medianNormalizedScore)}`}
        onClick={() => onOpen({ type: "score", title: "成绩风险" })}
      />
      <KpiCard
        icon={Clock3}
        label="成绩待发布"
        value={String(diagnosis.kpis.pendingReleaseCount)}
        sub={`${diagnosis.kpis.gradedStudents} 份已批改`}
        tone={diagnosis.kpis.pendingReleaseCount > 0 ? "warn" : "default"}
        onClick={() => onOpen({ type: "pending", title: "成绩待发布" })}
      />
      <KpiCard
        icon={AlertCircle}
        label="风险章节 / 学生"
        value={`${diagnosis.kpis.riskChapterCount}/${diagnosis.kpis.riskStudentCount}`}
        sub={`${diagnosis.kpis.instanceCount} 个任务实例`}
        tone={diagnosis.kpis.riskChapterCount + diagnosis.kpis.riskStudentCount > 0 ? "risk" : "default"}
        onClick={() => onOpen({ type: "risk", title: "风险章节与学生" })}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  onClick,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "warn" | "risk";
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className={cn("rounded-xl border-border/70 bg-white py-3 shadow-sm transition-colors hover:border-brand/60", tone === "warn" && "border-amber-200 bg-amber-50/50", tone === "risk" && "border-rose-200 bg-rose-50/50")}>
        <CardContent className="px-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="grid size-8 place-items-center rounded-lg bg-muted/70">
              <Icon className="size-4 text-muted-foreground" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{sub}</span>
            <ChevronRight className="size-3" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function KpiMiniCard({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="rounded-xl border-border/70 bg-white py-3 shadow-sm transition-colors hover:border-brand/60">
        <CardContent className="px-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <Info className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold tracking-normal">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
            </div>
            <Icon className="size-8 text-brand/70" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function RiskSignalCard({ diagnosis, onOpen }: { diagnosis: AnalyticsV2Diagnosis; onOpen: () => void }) {
  const highRisk = diagnosis.risks.chapters.slice(0, 3);
  return (
    <button type="button" onClick={onOpen} className="text-left">
      <Card className="rounded-xl border-rose-200 bg-rose-50/60 py-3 shadow-sm transition-colors hover:border-rose-300">
        <CardContent className="px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-rose-900">
                <ShieldAlert className="size-4" />
                风险信号
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-normal text-rose-700">
                {diagnosis.kpis.riskChapterCount + diagnosis.kpis.riskStudentCount}
              </div>
              <div className="mt-1 text-xs text-rose-800/70">
                章节 {diagnosis.kpis.riskChapterCount} · 学生 {diagnosis.kpis.riskStudentCount}
              </div>
            </div>
            <ArrowRight className="size-5 text-rose-500" />
          </div>
          {highRisk.length > 0 && (
            <div className="mt-3 space-y-1">
              {highRisk.map((chapter) => (
                <div key={chapter.chapterId ?? chapter.title} className="truncate rounded-md bg-white/70 px-2 py-1 text-xs text-rose-900">
                  {chapter.title} · 均分 {formatPercentNumber(chapter.avgNormalizedScore)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

function ScoreDistributionCard({
  diagnosis,
  scoreBins,
  density = "compact",
  onModeChange,
  onOpenBin,
}: {
  diagnosis: AnalyticsV2Diagnosis;
  scoreBins: ScoreBinMode;
  density?: "compact" | "chart";
  onModeChange: (mode: ScoreBinMode) => void;
  onOpenBin: (bin: AnalyticsV2Diagnosis["scoreDistribution"]["bins"][number]) => void;
}) {
  const bins = diagnosis.scoreDistribution.bins;
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const chartHeight = density === "chart" ? "h-64" : "h-36";
  return (
    <Card className="rounded-xl border-border/70 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="size-4 text-brand" />
              学生成绩分布
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {total > 0 ? `当前范围 ${total} 名学生，点击分数段查看名单` : "当前筛选范围暂无已评分学生"}
            </p>
          </div>
          <div className="flex rounded-md border p-0.5">
            {(["standard", "ten"] as ScoreBinMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn("rounded px-2.5 py-1 text-xs transition-colors", scoreBins === mode ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground")}
                onClick={() => onModeChange(mode)}
              >
                {BIN_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {bins.every((bin) => bin.count === 0) ? (
          <EmptyInline text="当前范围暂无已评分学生" />
        ) : (
          <>
            <div className={cn("grid items-end gap-2 rounded-lg border bg-muted/20 px-3 pb-3 pt-6", chartHeight)} style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}>
              {bins.map((bin) => {
                const percent = bin.count === 0 ? 0 : Math.max(8, (bin.count / maxCount) * 100);
                const active = bin.count > 0;
                return (
                  <button
                    key={bin.id}
                    type="button"
                    className="group flex h-full min-w-0 flex-col items-center justify-end gap-2 text-center"
                    onClick={() => onOpenBin(bin)}
                    disabled={!active}
                    title={`${bin.label}: ${bin.count} 人`}
                  >
                    <span className={cn("text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{bin.count}</span>
                    <span className="flex h-full w-full items-end justify-center">
                      <span
                        className={cn(
                          "w-full max-w-12 rounded-t-md transition-colors",
                          active ? "bg-gradient-to-t from-brand to-blue-400 group-hover:from-brand/90" : "bg-muted",
                        )}
                        style={{ height: `${percent}%` }}
                      />
                    </span>
                    <span className="line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">{bin.label}</span>
                  </button>
                );
              })}
            </div>
            <div className={cn("grid gap-2", density === "chart" ? "md:grid-cols-5" : "md:grid-cols-2")}>
              {(density === "chart" ? bins : bins.filter((bin) => bin.count > 0)).map((bin) => (
                <button
                  key={`${bin.id}-summary`}
                  type="button"
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:border-brand/50 hover:bg-muted/30"
                  onClick={() => onOpenBin(bin)}
                >
                  <span className="truncate text-muted-foreground">{bin.label}</span>
                  <span className="ml-2 font-semibold">{bin.count} 人</span>
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TaskPerformanceCard({
  diagnosis,
  density = "compact",
  onSelectTask,
  onEvidence,
}: {
  diagnosis: AnalyticsV2Diagnosis;
  density?: "compact" | "chart";
  onSelectTask: (id: string) => void;
  onEvidence: (summary: EvidenceSummary) => void;
}) {
  const perf = diagnosis.taskPerformance;
  const taskLimit = density === "chart" ? 6 : 5;
  if (perf.mode === "single") {
    return (
      <Card className="rounded-xl border-border/70 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-brand" />
            任务表现
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <EvidenceSection title="高分典型表现" items={perf.highExamples} emptyText="当前任务暂无高分证据" onEvidence={onEvidence} tone="success" />
          <LowIssueSection issues={perf.lowIssues} onEvidence={onEvidence} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border/70 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-brand" />
              任务表现
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {perf.taskComparisons.length > 0 ? `按当前筛选范围展示 ${perf.taskComparisons.length} 个任务` : "当前范围暂无任务实例"}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full">
            {diagnosis.scope.taskType ? TASK_TYPE_LABELS[diagnosis.scope.taskType] : "全部模式"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {perf.taskComparisons.length === 0 ? (
          <EmptyInline text="当前范围暂无任务实例" />
        ) : (
          <>
            {density === "chart" && (
              <div className="grid gap-3 md:grid-cols-2">
                <EvidenceSection title="高分典型表现" items={perf.highExamples.slice(0, 3)} emptyText="暂无高分证据" onEvidence={onEvidence} tone="success" />
                <LowIssueSection issues={perf.lowIssues.slice(0, 3)} onEvidence={onEvidence} />
              </div>
            )}
            <div className="space-y-2">
              {perf.taskComparisons.slice(0, taskLimit).map((task) => (
                <button
                  key={task.instanceId}
                  type="button"
                  className="w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-brand/50 hover:bg-muted/30"
                  onClick={() => onSelectTask(task.instanceId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{task.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px]">{TASK_TYPE_LABELS[task.taskType]}</Badge>
                        <span>{task.className}</span>
                        <span>·</span>
                        <span className="truncate">{task.sectionTitle ?? task.chapterTitle ?? "未绑定章节"}</span>
                      </div>
                    </div>
                    <Badge variant={task.riskLevel === "high" ? "destructive" : task.riskLevel === "medium" ? "secondary" : "outline"} className="shrink-0 rounded-md">
                      {task.riskLevel === "high" ? "高风险" : task.riskLevel === "medium" ? "需关注" : "稳定"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <MetricBar label="完成率" value={task.completionRate} kind="rate" />
                    <MetricBar label="均分" value={task.avgNormalizedScore} kind="percent" />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceSection({
  title,
  items,
  emptyText,
  tone = "default",
  onEvidence,
}: {
  title: string;
  items: EvidenceSummary[];
  emptyText: string;
  tone?: "default" | "success";
  onEvidence: (summary: EvidenceSummary) => void;
}) {
  return (
    <div className={cn("space-y-2 rounded-lg border p-3", tone === "success" && "border-emerald-200 bg-emerald-50/50")}>
      <div className={cn("text-sm font-medium", tone === "success" && "text-emerald-900")}>{title}</div>
      {items.length === 0 ? (
        <EmptyInline text={emptyText} />
      ) : (
        items.slice(0, 4).map((item) => <EvidenceButton key={item.submissionId} item={item} onEvidence={onEvidence} />)
      )}
    </div>
  );
}

function LowIssueSection({
  issues,
  onEvidence,
}: {
  issues: AnalyticsV2Diagnosis["taskPerformance"]["lowIssues"];
  onEvidence: (summary: EvidenceSummary) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
      <div className="text-sm font-medium text-rose-900">低分共性问题</div>
      {issues.length === 0 ? (
        <EmptyInline text="当前范围暂无明显低分问题" />
      ) : (
        issues.slice(0, 4).map((issue) => (
          <div key={issue.id} className="rounded-md bg-white/80 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm font-medium leading-5">{issue.title}</div>
              <Badge variant="outline" className="shrink-0 rounded-md border-rose-200 text-rose-700">
                {formatIssueMetric(issue.metric)}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{issue.detail}</p>
            {issue.evidence[0] && (
              <div className="mt-2">
                <EvidenceButton item={issue.evidence[0]} onEvidence={onEvidence} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function EvidenceButton({ item, onEvidence }: { item: EvidenceSummary; onEvidence: (summary: EvidenceSummary) => void }) {
  return (
    <button type="button" onClick={() => onEvidence(item)} className="w-full rounded-md border bg-white px-3 py-2 text-left transition-colors hover:border-brand/50 hover:bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm font-medium">{item.title}</div>
        <Badge variant="outline" className="shrink-0 rounded-md">{TASK_TYPE_LABELS[item.evidenceKind]}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.excerpt}</p>
    </button>
  );
}

function StudyBuddyCard({ diagnosis, density = "compact" }: { diagnosis: AnalyticsV2Diagnosis; density?: "compact" | "chart" }) {
  const data = diagnosis.studyBuddySignals;
  const limit = density === "chart" ? 8 : 5;
  return (
    <Card className="rounded-xl border-border/70 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="size-4 text-brand" />
              Study Buddy 典型问题
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.totalQuestions} 个问题 · {data.activeStudents} 名学生 · {data.pendingQuestions} 个待处理
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-full">{data.groups.length} 组</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.groups.length === 0 ? (
          <EmptyInline text="当前范围暂无学生提问" />
        ) : (
          data.groups.slice(0, limit).map((group, index) => (
            <div key={group.id} className="rounded-lg border px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{group.sectionTitle || group.chapterTitle || group.taskTitle}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{group.taskTitle}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div className="font-semibold">{group.questionCount} 次</div>
                  <div className="text-muted-foreground">{group.studentCount} 人</div>
                </div>
              </div>
              {group.topQuestions[0] && (
                <div className="mt-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs leading-5">
                  <span className="font-medium">{group.topQuestions[0].count}x</span>
                  <span className="ml-2 text-muted-foreground">{group.topQuestions[0].question}</span>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AiAdviceCard({
  advice,
  job,
  density = "wide",
  disabled,
  onGenerate,
}: {
  advice: DataInsightAdvice | null;
  job: AsyncJobSnapshot | null;
  density?: "wide" | "compact";
  disabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <Card className="rounded-xl border-border/70 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="size-4 text-brand" />
              AI 教学建议
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">基于当前筛选范围生成可执行的下一步建议</p>
          </div>
          <Button size="sm" onClick={onGenerate} disabled={disabled}>
            {disabled ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
            生成
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {job?.status === "failed" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {job.error ?? "AI 建议生成失败"}
          </div>
        ) : advice ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm leading-6">{advice.summary}</p>
            <div className={cn("grid gap-3", density === "wide" && "lg:grid-cols-3")}>
              <AdvicePanel icon={Target} title="知识目标" items={advice.knowledgeGoals} />
              <AdvicePanel icon={Brain} title="教学方式" items={advice.teachingMethods} />
              <AdvicePanel icon={Users} title="关注群体" items={advice.focusGroups} />
            </div>
            <AdviceList title="下一步动作" items={advice.nextActions} />
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">依据</div>
              {advice.evidenceRefs.slice(0, 4).map((ref) => (
                <div key={ref.id} className="rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                  <span className="font-medium">{ref.label}</span>
                  <span className="ml-2 text-muted-foreground">{ref.detail}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyInline text={isJobRunning(job) ? `AI 建议生成中 ${job?.progress ?? 0}%` : "点击生成当前筛选范围的教学建议"} />
        )}
      </CardContent>
    </Card>
  );
}

function RiskListCard({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  return (
    <Card className="rounded-xl border-border/70 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4 text-rose-600" />
          风险明细
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">高风险章节</div>
          {diagnosis.risks.chapters.length === 0 ? (
            <EmptyInline text="暂无风险章节" />
          ) : (
            diagnosis.risks.chapters.slice(0, 5).map((chapter) => (
              <div key={chapter.chapterId ?? chapter.title} className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2">
                <div className="truncate text-sm font-medium text-rose-950">{chapter.title}</div>
                <div className="mt-1 text-xs text-rose-800/70">
                  完成 {formatRate(chapter.completionRate)} · 均分 {formatPercentNumber(chapter.avgNormalizedScore)}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">需关注学生</div>
          {diagnosis.risks.students.length === 0 ? (
            <EmptyInline text="暂无学生风险" />
          ) : (
            diagnosis.risks.students.slice(0, 6).map((student) => (
              <div key={student.studentId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{student.studentName}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{student.className}</div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {student.reasons.map((reason) => (
                    <Badge key={reason} variant="secondary" className="rounded-md text-[10px]">
                      {REASON_LABELS[reason]}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdvicePanel({ icon: Icon, title, items }: { icon: typeof BarChart3; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border bg-blue-50/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand">
        <Icon className="size-4" />
        {title}
      </div>
      <ul className="space-y-1 text-sm leading-6">
        {items.slice(0, 4).map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdviceList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-md border px-2 py-1.5">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DataQualityPanel({ flags }: { flags: AnalyticsV2Diagnosis["dataQualityFlags"] }) {
  if (flags.length === 0) return null;
  return (
    <Card className="rounded-lg border-amber-200 bg-amber-50/50">
      <CardContent className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-amber-700" />
          <span className="font-medium">数据质量提示</span>
          <Badge variant="outline" className="rounded-md bg-background">{flags.length} 项</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {flags.slice(0, 3).map((flag) => (
            <Badge key={flag.id} variant={flag.severity === "critical" ? "destructive" : "secondary"} className="rounded-md">
              {flag.entityLabel ? `${flag.entityLabel}：` : ""}{flag.title}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailSheetView({ diagnosis, detail, onClose }: { diagnosis: AnalyticsV2Diagnosis | null; detail: DetailSheet; onClose: () => void }) {
  if (!diagnosis || !detail) {
    return <Sheet open={false} onOpenChange={onClose} />;
  }

  return (
    <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{detail.title}</SheetTitle>
          <SheetDescription>当前筛选范围内的可追溯明细</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          {detail.type === "distribution" && <DistributionDetail bin={detail.bin} />}
          {detail.type === "completion" && <CompletionDetail diagnosis={diagnosis} />}
          {detail.type === "score" && <ScoreRiskDetail diagnosis={diagnosis} />}
          {detail.type === "pending" && <PendingDetail diagnosis={diagnosis} />}
          {detail.type === "risk" && <RiskDetail diagnosis={diagnosis} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DistributionDetail({ bin }: { bin: AnalyticsV2Diagnosis["scoreDistribution"]["bins"][number] }) {
  if (bin.students.length === 0) return <EmptyInline text="该分数段暂无学生" />;
  return (
    <div className="space-y-2">
      {bin.students.map((student) => (
        <div key={student.studentId} className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{student.studentName}</div>
            <Badge variant="outline" className="rounded-md">{formatPercentNumber(student.score)}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{student.className} · {student.completedInstances} 个任务 · {student.attemptCount} 次提交</div>
          <div className="mt-2 space-y-1">
            {student.contributions.slice(0, 5).map((item) => (
              <div key={`${student.studentId}-${item.instanceId}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs">
                <span className="truncate">{item.instanceTitle}</span>
                <span className="ml-2 shrink-0">{formatPercentNumber(item.score)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompletionDetail({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  const rows = diagnosis.risks.students.filter((student) => student.reasons.includes("not_submitted"));
  if (rows.length === 0) return <EmptyInline text="当前范围暂无未完成风险学生" />;
  return <RiskStudentList rows={rows} />;
}

function ScoreRiskDetail({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  const rows = diagnosis.risks.students.filter((student) => student.reasons.includes("low_score") || student.reasons.includes("declining"));
  if (rows.length === 0) return <EmptyInline text="当前范围暂无低分或退步风险学生" />;
  return <RiskStudentList rows={rows} />;
}

function PendingDetail({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  const rows = diagnosis.risks.pendingReleases;
  if (rows.length === 0) return <EmptyInline text="当前范围暂无待发布成绩" />;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.submissionId} className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{row.studentName}</div>
            <Badge variant="secondary" className="rounded-md">{formatRawScore(row.score, row.maxScore)}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{row.instanceTitle} · {row.className} · {formatDate(row.submittedAt)}</div>
        </div>
      ))}
    </div>
  );
}

function RiskDetail({ diagnosis }: { diagnosis: AnalyticsV2Diagnosis }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">风险章节</div>
        {diagnosis.risks.chapters.length === 0 ? <EmptyInline text="暂无风险章节" /> : diagnosis.risks.chapters.map((chapter) => (
          <div key={chapter.chapterId ?? "unassigned"} className="rounded-md border p-3">
            <div className="font-medium">{chapter.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">完成率 {formatRate(chapter.completionRate)} · 均分 {formatPercentNumber(chapter.avgNormalizedScore)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{chapter.reasons.map((reason) => <Badge key={reason} variant="secondary" className="rounded-md">{reason}</Badge>)}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">风险学生</div>
        <RiskStudentList rows={diagnosis.risks.students} />
      </div>
    </div>
  );
}

function RiskStudentList({ rows }: { rows: AnalyticsV2Diagnosis["risks"]["students"] }) {
  if (rows.length === 0) return <EmptyInline text="暂无学生风险" />;
  return (
    <div className="space-y-2">
      {rows.map((student) => (
        <div key={student.studentId} className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{student.studentName}</div>
            <Badge variant="outline" className="rounded-md">{formatPercentNumber(student.selectedScore)}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{student.className} · 变化 {formatPointChange(student.improvement)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {student.reasons.map((reason) => <Badge key={reason} variant="secondary" className="rounded-md">{REASON_LABELS[reason]}</Badge>)}
          </div>
          <div className="mt-2 space-y-1">
            {student.affectedInstances.slice(0, 4).map((item) => (
              <div key={`${student.studentId}-${item.instanceId}-${item.reason}`} className="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                {item.title} · {REASON_LABELS[item.reason as keyof typeof REASON_LABELS] ?? item.reason}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceSheet({ open, loading, data, onOpenChange }: { open: boolean; loading: boolean; data: Record<string, unknown> | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{data ? `${getNestedText(data, ["student", "name"])} · ${TASK_TYPE_LABELS[getText(data, "taskType") as TaskType] ?? "证据"}` : "证据"}</SheetTitle>
          <SheetDescription>学生真实提交与 AI 批改记录</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {loading ? (
            <CenteredInline text="加载证据中" />
          ) : data ? (
            <EvidenceBody data={data} />
          ) : (
            <EmptyInline text="暂无证据数据" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EvidenceBody({ data }: { data: Record<string, unknown> }) {
  const taskType = getText(data, "taskType") as TaskType;
  return (
    <>
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{getNestedText(data, ["taskInstance", "title"]) || getNestedText(data, ["task", "taskName"])}</div>
          <Badge variant="outline" className="rounded-md">{formatRawScore(getNumber(data, "score"), getNumber(data, "maxScore"))}</Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{getNestedText(data, ["taskInstance", "course", "courseTitle"])} · {formatDate(getText(data, "submittedAt"))}</div>
      </div>
      {taskType === "simulation" && <SimulationEvidence data={getRecord(data, "simulation")} />}
      {taskType === "quiz" && <QuizEvidence data={getRecord(data, "quiz")} />}
      {taskType === "subjective" && <SubjectiveEvidence data={getRecord(data, "subjective")} />}
    </>
  );
}

function SimulationEvidence({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <EmptyInline text="暂无模拟对话证据" />;
  const transcript = getArray(data, "transcript");
  return (
    <div className="space-y-3">
      <EvaluationBlock evaluation={getRecord(data, "evaluation")} />
      <div className="space-y-2">
        <div className="text-sm font-medium">对话记录</div>
        {transcript.length === 0 ? <EmptyInline text="暂无对话记录" /> : transcript.map((message, index) => {
          const record = typeof message === "object" && message !== null ? message as Record<string, unknown> : {};
          const role = String(record.role ?? "");
          return (
            <div key={index} className={cn("rounded-md px-3 py-2 text-sm", role === "student" || role === "user" ? "bg-blue-50" : "bg-muted/60")}>
              <div className="mb-1 text-xs font-medium text-muted-foreground">{role === "student" || role === "user" ? "学生" : "AI"}</div>
              <div className="whitespace-pre-wrap">{String(record.text ?? record.content ?? "")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuizEvidence({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <EmptyInline text="暂无测验证据" />;
  return (
    <div className="space-y-3">
      <EvaluationBlock evaluation={getRecord(data, "evaluation")} />
      <div className="text-sm font-medium">作答明细</div>
      <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify({ answers: data.answers, questions: data.questions }, null, 2)}</pre>
    </div>
  );
}

function SubjectiveEvidence({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <EmptyInline text="暂无主观题证据" />;
  return (
    <div className="space-y-3">
      <EvaluationBlock evaluation={getRecord(data, "evaluation")} />
      <div className="space-y-1">
        <div className="text-sm font-medium">文本作答</div>
        <div className="whitespace-pre-wrap rounded-md border p-3 text-sm">{getText(data, "textAnswer") || "无"}</div>
      </div>
      {getText(data, "extractedText") && (
        <div className="space-y-1">
          <div className="text-sm font-medium">附件提取文本</div>
          <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">{getText(data, "extractedText")}</div>
        </div>
      )}
    </div>
  );
}

function EvaluationBlock({ evaluation }: { evaluation: Record<string, unknown> | null }) {
  if (!evaluation) return <EmptyInline text="暂无批改记录" />;
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">AI 批改</div>
      {typeof evaluation.feedback === "string" && <div className="rounded-md border p-3 text-sm leading-6">{evaluation.feedback}</div>}
      <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(evaluation, null, 2)}</pre>
    </div>
  );
}

function MetricBar({ label, value, kind }: { label: string; value: number | null; kind: "rate" | "percent" }) {
  const raw = value === null ? 0 : kind === "rate" ? value * 100 : value;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{kind === "rate" ? formatRate(value) : formatPercentNumber(value)}</span>
      </div>
      <Progress value={clampProgress(raw)} />
    </div>
  );
}

function CenteredState({ icon: Icon, title, spinning = false }: { icon: typeof BarChart3; title: string; spinning?: boolean }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex min-h-[320px] flex-col items-center justify-center text-center">
        <Icon className={cn("size-9 text-muted-foreground", spinning && "animate-spin")} />
        <div className="mt-4 font-medium">{title}</div>
      </CardContent>
    </Card>
  );
}

function CenteredInline({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed py-8 text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      {text}
    </div>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function isJobRunning(job: AsyncJobSnapshot | null) {
  return job?.status === "queued" || job?.status === "running";
}

function isAdvice(value: unknown): value is DataInsightAdvice {
  return Boolean(value && typeof value === "object" && "summary" in value && "fingerprint" in value);
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatPercentNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 10) / 10}%`;
}

function formatPointChange(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}pp`;
}

function formatRawScore(score: number | null | undefined, maxScore: number | null | undefined) {
  if (score === null || score === undefined) return "无";
  return `${Math.round(score * 10) / 10}/${maxScore ?? "?"}`;
}

function formatIssueMetric(value: number | null | undefined) {
  if (value === null || value === undefined) return "无数据";
  if (value <= 1) return `${Math.round(value * 1000) / 10}%`;
  return `${Math.round(value * 10) / 10}`;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "无";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function getRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function getText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function getNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function getNestedText(record: Record<string, unknown>, path: string[]): string {
  let current: unknown = record;
  for (const key of path) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}
