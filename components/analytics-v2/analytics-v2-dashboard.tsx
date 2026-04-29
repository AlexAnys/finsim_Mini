"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  ListChecks,
  Loader2,
  RefreshCw,
  Target,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    classId: string | null;
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
  weeklyInsight: {
    generatedAt: string | null;
    highlights: unknown[];
    risks: unknown[];
  };
  trends: unknown[];
}

const ALL = "__all__";

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  simulation: "Simulation",
  quiz: "Quiz",
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
  const [error, setError] = useState<string | null>(null);

  const courseId = searchParams.get("courseId") ?? "";
  const chapterId = searchParams.get("chapterId") ?? "";
  const sectionId = searchParams.get("sectionId") ?? "";
  const classId = searchParams.get("classId") ?? "";
  const taskType = (searchParams.get("taskType") ?? "") as TaskType | "";
  const taskInstanceId = searchParams.get("taskInstanceId") ?? "";
  const scorePolicy = ((searchParams.get("scorePolicy") ?? "latest") as ScorePolicy);
  const range = ((searchParams.get("range") ?? "term") as RangeValue);

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

  const filteredSections = useMemo(() => {
    const sections = diagnosis?.filterOptions.sections ?? [];
    return chapterId ? sections.filter((section) => section.chapterId === chapterId) : sections;
  }, [chapterId, diagnosis]);

  const filteredInstances = useMemo(() => {
    return (diagnosis?.filterOptions.taskInstances ?? []).filter((instance) => {
      if (chapterId && instance.chapterId !== chapterId) return false;
      if (sectionId && instance.sectionId !== sectionId) return false;
      if (classId && instance.classId !== classId) return false;
      if (taskType && instance.taskType !== taskType) return false;
      return true;
    });
  }, [chapterId, classId, diagnosis, sectionId, taskType]);

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
    if (!courseId) return;
    router.replace(`${pathname}?courseId=${encodeURIComponent(courseId)}`);
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
        <Button variant="outline" size="sm" onClick={resetFilters} disabled={!courseId}>
          <RefreshCw className="mr-2 size-3.5" />
          重置筛选
        </Button>
      </div>

      <Card className="rounded-lg py-4">
        <CardContent className="space-y-4 px-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="课程"
              value={courseId || ALL}
              placeholder="选择课程"
              onChange={(value) =>
                replaceQuery({
                  courseId: value,
                  chapterId: null,
                  sectionId: null,
                  classId: null,
                  taskType: null,
                  taskInstanceId: null,
                })
              }
              options={courses.map((course) => ({
                value: course.id,
                label: course.class?.name
                  ? `${course.courseTitle} · ${course.class.name}`
                  : course.courseTitle,
              }))}
            />
            <FilterSelect
              label="章节"
              value={chapterId || ALL}
              disabled={!diagnosis}
              onChange={(value) => replaceQuery({ chapterId: value, sectionId: null, taskInstanceId: null })}
              options={(diagnosis?.filterOptions.chapters ?? []).map((chapter) => ({
                value: chapter.id,
                label: `${chapter.order}. ${chapter.title}`,
              }))}
            />
            <FilterSelect
              label="小节"
              value={sectionId || ALL}
              disabled={!diagnosis}
              onChange={(value) => replaceQuery({ sectionId: value, taskInstanceId: null })}
              options={filteredSections.map((section) => ({
                value: section.id,
                label: `${section.order}. ${section.title}`,
              }))}
            />
            <FilterSelect
              label="班级"
              value={classId || ALL}
              disabled={!diagnosis}
              onChange={(value) => replaceQuery({ classId: value, taskInstanceId: null })}
              options={(diagnosis?.filterOptions.classes ?? []).map((klass) => ({
                value: klass.id,
                label: klass.name,
              }))}
            />
            <FilterSelect
              label="模式"
              value={taskType || ALL}
              disabled={!diagnosis}
              onChange={(value) => replaceQuery({ taskType: value, taskInstanceId: null })}
              options={(diagnosis?.filterOptions.taskTypes ?? []).map((type) => ({
                value: type.value,
                label: `${type.label} (${type.count})`,
              }))}
            />
            <FilterSelect
              label="测试实例"
              value={taskInstanceId || ALL}
              disabled={!diagnosis}
              onChange={(value) => replaceQuery({ taskInstanceId: value })}
              options={filteredInstances.map((instance) => ({
                value: instance.id,
                label: `${instance.title} · ${instance.className}`,
              }))}
            />
            <FilterSelect
              label="计分口径"
              value={scorePolicy}
              onChange={(value) => replaceQuery({ scorePolicy: value })}
              options={[
                { value: "latest", label: SCORE_POLICY_LABELS.latest },
                { value: "best", label: SCORE_POLICY_LABELS.best },
                { value: "first", label: SCORE_POLICY_LABELS.first },
              ]}
            />
            <FilterSelect
              label="时间范围"
              value={range}
              onChange={(value) => replaceQuery({ range: value })}
              options={[
                { value: "term", label: RANGE_LABELS.term },
                { value: "30d", label: RANGE_LABELS["30d"] },
                { value: "7d", label: RANGE_LABELS["7d"] },
              ]}
            />
          </div>

          {scopeTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">当前范围</span>
              {scopeTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="rounded-md">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard icon={CheckCircle2} label="完成率" value={formatRate(diagnosis.kpis.completionRate)} sub={`${diagnosis.kpis.submittedStudents}/${diagnosis.kpis.assignedStudents} 人次`} />
            <KpiCard icon={Target} label="归一化均分" value={formatPercentNumber(diagnosis.kpis.avgNormalizedScore)} sub={`中位数 ${formatPercentNumber(diagnosis.kpis.medianNormalizedScore)}`} />
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
                <TabsTrigger value="quiz">Quiz 题库</TabsTrigger>
                <TabsTrigger value="rubric">Simulation/主观题</TabsTrigger>
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
              <PlaceholderTab title="AI 周洞察" description="P2 将接入周度生成、证据引用与教师操作建议。" />
            </TabsContent>
            <TabsContent value="trends">
              <PlaceholderTab title="长期趋势" description="P3 将沉淀跨周趋势、概念稳定性和班级 cohort 对比。" />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
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
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 w-full rounded-md">
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

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="rounded-lg py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-normal">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
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
                    return (
                      <div
                        key={`${chapter}-${className}`}
                        className={cn("rounded-md border px-2 py-2", heatClass(score, cell?.completionRate ?? null))}
                      >
                        <div className="font-semibold">{formatPercentNumber(score)}</div>
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
  if (rows.length === 0) return <PlaceholderTab title="Quiz 题库" description="当前范围没有可聚合的 quizBreakdown 或题目元数据。" />;
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">Quiz 题目诊断</CardTitle>
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
  if (rows.length === 0) return <PlaceholderTab title="Simulation/主观题" description="当前范围没有可聚合的 rubricBreakdown 或评分维度元数据。" />;
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">Rubric 维度诊断</CardTitle>
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
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatRate(value)}</span>
      </div>
      <Progress value={value === null ? 0 : value * 100} />
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
  const className = filterOptions.classes.find((item) => item.id === scope.classId)?.name;
  const chapterTitle = filterOptions.chapters.find((item) => item.id === scope.chapterId)?.title;
  const sectionTitle = filterOptions.sections.find((item) => item.id === scope.sectionId)?.title;
  const instanceTitle = filterOptions.taskInstances.find((item) => item.id === scope.taskInstanceId)?.title;
  return [
    `课程：${scope.courseTitle}`,
    chapterTitle ? `章节：${chapterTitle}` : "章节：全部",
    sectionTitle ? `小节：${sectionTitle}` : "小节：全部",
    className ? `班级：${className}` : "班级：全部",
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

function actionMetric(item: AnalyticsV2Diagnosis["actionItems"][number]) {
  if (item.type === "low_completion") return formatRate(item.metric);
  if (item.type === "low_score") return formatPercentNumber(item.metric);
  return `${item.metric} 人次`;
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatPercentNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 10) / 10}%`;
}
