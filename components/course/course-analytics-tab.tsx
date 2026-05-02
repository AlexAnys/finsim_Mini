"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  BarChart3,
  Users,
  TrendingUp,
  Award,
  ChevronRight,
  ChevronDown,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// --- Types ---

interface CourseAnalyticsTabProps {
  courseId: string;
}

interface InstanceItem {
  id: string;
  title: string;
  taskType?: string;
  task?: { taskType: string };
  class?: { name: string };
  chapter?: { id: string; title: string; order: number } | null;
  section?: { id: string; title: string; order: number } | null;
  slot?: string | null;
}

interface InstanceStats {
  instanceId: string;
  title: string;
  taskType: string;
  chapterId: string | null;
  chapterTitle: string;
  chapterOrder: number;
  sectionId: string | null;
  sectionTitle: string;
  sectionOrder: number;
  slot: string | null;
  submissionCount: number;
  gradedCount: number;
  avgScore: number;
  maxScore: number;
  totalStudents: number;
  validScoreCount: number;
  abnormalCount: number;
  qualityFlags: string[];
}

interface StudentPerformance {
  studentId: string;
  studentName: string;
  submissionCount: number;
  avgScore: number;
  gradedCount: number;
}

interface BucketStudent {
  id: string;
  name: string;
  score: number;
}

interface DistributionBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  students: BucketStudent[];
}

interface CriterionScore {
  studentId: string;
  studentName: string;
  score: number;
  maxScore: number;
  comment: string;
}

interface CriterionStat {
  criterionId: string;
  criterionName: string;
  maxPoints: number;
  description: string | null;
  avgScore: number;
  scores: CriterionScore[];
  weakStudents: CriterionScore[];
}

interface SubmissionSummary {
  id: string;
  studentId: string;
  studentName: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: string;
  gradedAt: string | null;
}

interface InsightsData {
  instance: {
    id: string;
    title: string;
    taskType: string;
    status: string;
    className: string;
  };
  stats: {
    totalSubmissions: number;
    gradedCount: number;
    avgScore: number;
    maxScore: number;
    highestScore: number;
    lowestScore: number;
  };
  distribution: DistributionBucket[];
  criteriaStats: CriterionStat[];
  weaknessByDimension: CriterionStat[];
  submissions: SubmissionSummary[];
}

interface TranscriptMessage {
  id?: string;
  role: string;
  text: string;
  timestamp?: string;
  mood?: string;
}

interface EvidenceData {
  studentName: string;
  criterionName: string;
  score: number;
  maxScore: number;
  comment: string;
  transcript: TranscriptMessage[];
  feedback: string;
}

interface ChapterDiagnosticSummary {
  key: string;
  chapterTitle: string;
  sectionTitle: string;
  chapterOrder: number;
  sectionOrder: number;
  taskCount: number;
  submissionCount: number;
  gradedCount: number;
  validScoreCount: number;
  abnormalCount: number;
  avgScore: number;
  completionRate: number;
  byType: Record<string, number>;
}

function normalizedScore(
  score: number | string | null | undefined,
  maxScore: number | string | null | undefined,
) {
  const rawScore = typeof score === "string" ? Number(score) : score;
  const rawMax = typeof maxScore === "string" ? Number(maxScore) : maxScore;
  if (
    typeof rawScore !== "number" ||
    typeof rawMax !== "number" ||
    !Number.isFinite(rawScore) ||
    !Number.isFinite(rawMax) ||
    rawMax <= 0 ||
    rawScore < 0
  ) {
    return { value: null, abnormal: true, reason: "score/maxScore 缺失或非法" };
  }
  const value = (rawScore / rawMax) * 100;
  if (!Number.isFinite(value) || value > 120) {
    return { value: null, abnormal: true, reason: "score/maxScore 超出合理范围" };
  }
  return { value: Math.round(value), abnormal: false, reason: null };
}

// Exported for testing: build the ranking list from raw submission data.
// B8 fix: students with gradedCount === 0 are excluded so unrated students don't tie with real zeros.
export function buildStudentRanking(
  submissionsByInstance: Array<{ subs: Array<{ student?: { id: string; name?: string }; status: string; score?: number | string | null; maxScore?: number | string | null }> }>
): StudentPerformance[] {
  const studentMap = new Map<string, StudentPerformance>();
  for (const { subs } of submissionsByInstance) {
    for (const sub of subs) {
      const student = sub.student;
      if (!student) continue;
      const existing = studentMap.get(student.id);
      if (existing) {
        existing.submissionCount++;
        if (sub.status === "graded") {
          const normalized = normalizedScore(sub.score, sub.maxScore ?? 100);
          if (normalized.value !== null) {
            existing.gradedCount++;
            existing.avgScore =
              (existing.avgScore * (existing.gradedCount - 1) + normalized.value) /
              existing.gradedCount;
          }
        }
      } else {
        const normalized = sub.status === "graded" ? normalizedScore(sub.score, sub.maxScore ?? 100) : null;
        studentMap.set(student.id, {
          studentId: student.id,
          studentName: student.name || "未知",
          submissionCount: 1,
          avgScore: normalized?.value ?? 0,
          gradedCount: normalized?.value !== null && normalized !== null ? 1 : 0,
        });
      }
    }
  }
  return Array.from(studentMap.values())
    .filter((sp) => sp.gradedCount > 0)
    .sort((a, b) => b.avgScore - a.avgScore);
}

// Exported for testing: partition Promise.allSettled results into successful / failed.
// Used by fetchSummary to keep per-task failures from killing the whole tab.
export function partitionSettledSubs<T>(
  instances: Array<{ id: string }>,
  settled: Array<PromiseSettledResult<T>>
): { fulfilled: Array<{ instanceId: string; value: T }>; failedIds: string[] } {
  const fulfilled: Array<{ instanceId: string; value: T }> = [];
  const failedIds: string[] = [];
  settled.forEach((r, idx) => {
    const instanceId = instances[idx]?.id;
    if (!instanceId) return;
    if (r.status === "fulfilled") {
      fulfilled.push({ instanceId, value: r.value });
    } else {
      failedIds.push(instanceId);
    }
  });
  return { fulfilled, failedIds };
}

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

interface SubmissionForStats {
  status: string;
  score?: number | string | null;
  maxScore?: number | string | null;
  student?: { id: string; name?: string };
}

function buildChapterDiagnostics(stats: InstanceStats[]): ChapterDiagnosticSummary[] {
  const map = new Map<string, ChapterDiagnosticSummary & { weightedScoreTotal: number }>();
  for (const stat of stats) {
    const key = `${stat.chapterId || "no-chapter"}:${stat.sectionId || "no-section"}`;
    const existing =
      map.get(key) ||
      {
        key,
        chapterTitle: stat.chapterTitle,
        sectionTitle: stat.sectionTitle,
        chapterOrder: stat.chapterOrder,
        sectionOrder: stat.sectionOrder,
        taskCount: 0,
        submissionCount: 0,
        gradedCount: 0,
        validScoreCount: 0,
        abnormalCount: 0,
        avgScore: 0,
        completionRate: 0,
        byType: {},
        weightedScoreTotal: 0,
      };
    existing.taskCount += 1;
    existing.submissionCount += stat.submissionCount;
    existing.gradedCount += stat.gradedCount;
    existing.validScoreCount += stat.validScoreCount;
    existing.abnormalCount += stat.abnormalCount;
    existing.weightedScoreTotal += stat.avgScore * stat.validScoreCount;
    existing.byType[stat.taskType] = (existing.byType[stat.taskType] || 0) + 1;
    map.set(key, existing);
  }
  return Array.from(map.values())
    .map(({ weightedScoreTotal, ...summary }) => ({
      ...summary,
      avgScore:
        summary.validScoreCount > 0
          ? Math.round(weightedScoreTotal / summary.validScoreCount)
          : 0,
      completionRate:
        summary.submissionCount > 0
          ? Math.round((summary.gradedCount / summary.submissionCount) * 100)
          : 0,
    }))
    .sort((a, b) => a.chapterOrder - b.chapterOrder || a.sectionOrder - b.sectionOrder);
}

// --- Component ---

export function CourseAnalyticsTab({ courseId }: CourseAnalyticsTabProps) {
  // Summary data
  const [instanceStats, setInstanceStats] = useState<InstanceStats[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedInstanceIds, setFailedInstanceIds] = useState<Set<string>>(new Set());
  const [failedInstanceTitles, setFailedInstanceTitles] = useState<Map<string, string>>(new Map());

  // Expandable task rows
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [insightsCache, setInsightsCache] = useState<Record<string, InsightsData>>({});
  const [insightsLoading, setInsightsLoading] = useState<Set<string>>(new Set());

  // Evidence sheet state
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);

  // Fetch course instances + build summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/lms/task-instances?courseId=${courseId}`);
      if (!res.ok) {
        toast.error("加载任务列表失败");
        return;
      }
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "加载任务列表失败");
        return;
      }

      const instances: InstanceItem[] = json.data || [];

      // 并行拉取每个 instance 的提交列表（allSettled 隔离失败，避免一个失败整 tab 挂）
      const settled = await Promise.allSettled(
        instances.map(async (inst) => {
          const subsRes = await fetch(
            `/api/submissions?taskInstanceId=${inst.id}&pageSize=200`
          );
          if (!subsRes.ok) throw new Error(`HTTP ${subsRes.status}`);
          const subsJson = await subsRes.json();
          if (subsJson.success === false) {
            throw new Error(subsJson.error?.message || "FETCH_FAILED");
          }
          const subs = subsJson.data?.items || subsJson.data || [];
          return { inst, subs };
        })
      );

      const { fulfilled, failedIds } = partitionSettledSubs(
        instances.map((i) => ({ id: i.id })),
        settled
      );
      const subsResults = fulfilled.map((f) => f.value);

      if (failedIds.length > 0) {
        toast.error(`${failedIds.length} 个任务数据加载失败，其余已显示`);
      }

      setFailedInstanceIds(new Set(failedIds));
      setFailedInstanceTitles(
        new Map(
          instances
            .filter((i) => failedIds.includes(i.id))
            .map((i) => [i.id, i.title])
        )
      );

      const stats: InstanceStats[] = subsResults.map(({ inst, subs }) => {
        const graded = (subs as SubmissionForStats[]).filter(
          (s) => s.status === "graded"
        );
        const normalized = graded.map((submission) =>
          normalizedScore(submission.score, submission.maxScore),
        );
        const validScores = normalized
          .map((item) => item.value)
          .filter((value): value is number => value !== null);
        const abnormalCount = normalized.filter((item) => item.abnormal).length;
        const qualityFlags = abnormalCount > 0
          ? [`${abnormalCount} 条 score/maxScore 异常，未计入均分`]
          : [];
        return {
          instanceId: inst.id,
          title: inst.title,
          taskType: inst.task?.taskType || inst.taskType || "",
          chapterId: inst.chapter?.id || null,
          chapterTitle: inst.chapter?.title || "未绑定章节",
          chapterOrder: inst.chapter?.order ?? 9999,
          sectionId: inst.section?.id || null,
          sectionTitle: inst.section?.title || "未绑定小节",
          sectionOrder: inst.section?.order ?? 9999,
          slot: inst.slot || null,
          submissionCount: subs.length,
          gradedCount: graded.length,
          avgScore:
            validScores.length > 0
              ? Math.round(
                  validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length
                )
              : 0,
          maxScore: graded.length > 0 ? Number(graded[0].maxScore || 100) : 100,
          totalStudents: subs.length,
          validScoreCount: validScores.length,
          abnormalCount,
          qualityFlags,
        };
      });

      setInstanceStats(stats);
      // B8 修复：ranking 过滤掉 gradedCount === 0 的学生（见 buildStudentRanking 定义）
      setStudentPerformance(buildStudentRanking(subsResults));
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Toggle task expansion + fetch insights on demand
  const toggleTask = useCallback(
    async (instanceId: string) => {
      setExpandedTasks((prev) => {
        const next = new Set(prev);
        if (next.has(instanceId)) {
          next.delete(instanceId);
        } else {
          next.add(instanceId);
        }
        return next;
      });

      // If already cached or currently loading, skip fetch
      if (insightsCache[instanceId]) return;
      if (insightsLoading.has(instanceId)) return;

      setInsightsLoading((prev) => new Set(prev).add(instanceId));

      try {
        const res = await fetch(`/api/lms/task-instances/${instanceId}/insights`);
        if (!res.ok) {
          toast.error("加载洞察数据失败");
          return;
        }
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "加载洞察数据失败");
          return;
        }
        setInsightsCache((prev) => ({ ...prev, [instanceId]: json.data }));
      } catch {
        toast.error("网络错误");
      } finally {
        setInsightsLoading((prev) => {
          const next = new Set(prev);
          next.delete(instanceId);
          return next;
        });
      }
    },
    [insightsCache, insightsLoading]
  );

  // Open evidence sheet
  const openEvidence = useCallback(
    async (
      submissionId: string,
      studentName: string,
      criterionId: string,
      criterionName: string
    ) => {
      setEvidenceOpen(true);
      setEvidenceLoading(true);
      setEvidence(null);

      try {
        const res = await fetch(`/api/submissions/${submissionId}`);
        if (!res.ok) {
          toast.error("加载提交详情失败");
          setEvidenceOpen(false);
          return;
        }
        const json = await res.json();
        if (!json.success) {
          toast.error("加载提交详情失败");
          setEvidenceOpen(false);
          return;
        }

        const sub = json.data;
        let transcript: TranscriptMessage[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let evaluation: any = null;

        if (sub.simulationSubmission) {
          transcript = (sub.simulationSubmission.transcript as TranscriptMessage[]) || [];
          evaluation = sub.simulationSubmission.evaluation;
        } else if (sub.quizSubmission) {
          evaluation = sub.quizSubmission.evaluation;
        } else if (sub.subjectiveSubmission) {
          evaluation = sub.subjectiveSubmission.evaluation;
        }

        let criterionComment = "";
        let criterionScore = 0;
        let criterionMaxScore = 0;
        const feedback = evaluation?.feedback || "";

        if (evaluation?.rubricBreakdown) {
          const bd = evaluation.rubricBreakdown.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (b: any) => b.criterionId === criterionId
          );
          if (bd) {
            criterionComment = bd.comment || "";
            criterionScore = bd.score || 0;
            criterionMaxScore = bd.maxScore || 0;
          }
        }

        setEvidence({
          studentName,
          criterionName,
          score: criterionScore,
          maxScore: criterionMaxScore,
          comment: criterionComment,
          transcript,
          feedback,
        });
      } catch {
        toast.error("网络错误");
        setEvidenceOpen(false);
      } finally {
        setEvidenceLoading(false);
      }
    },
    []
  );

  // Find submission ID for a student within a given insight data
  function findSubmissionId(insights: InsightsData, studentId: string): string | null {
    const sub = insights.submissions.find(
      (s) => s.studentId === studentId && s.status === "graded"
    );
    return sub?.id || null;
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载分析数据...</span>
      </div>
    );
  }

  // --- Empty state (nothing succeeded AND nothing failed = no tasks at all) ---
  if (instanceStats.length === 0 && failedInstanceIds.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">暂无分析数据</h3>
        <p className="text-sm text-muted-foreground max-w-sm">发布任务并收到学生提交后，这里将显示分析数据</p>
      </div>
    );
  }

  // --- Computed summary ---
  const totalSubmissions = instanceStats.reduce((s, i) => s + i.submissionCount, 0);
  const totalGraded = instanceStats.reduce((s, i) => s + i.gradedCount, 0);
  const gradedStats = instanceStats.filter((s) => s.validScoreCount > 0);
  const abnormalScoreCount = instanceStats.reduce((s, i) => s + i.abnormalCount, 0);
  const overallAvg =
    gradedStats.length > 0
      ? Math.round(
          gradedStats.reduce((s, i) => s + i.avgScore * i.validScoreCount, 0) /
            gradedStats.reduce((s, i) => s + i.validScoreCount, 0),
        )
      : 0;
  const chapterDiagnostics = buildChapterDiagnostics(instanceStats);

  return (
    <div className="space-y-6">
      {/* ========== 1. Course-level Summary Cards ========== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">任务总数</p>
                <p className="text-2xl font-bold mt-1">{instanceStats.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总提交</p>
                <p className="text-2xl font-bold mt-1">{totalSubmissions}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已批改</p>
                <p className="text-2xl font-bold mt-1">{totalGraded}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">均分</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{overallAvg}</p>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                {abnormalScoreCount > 0 && (
                  <Badge variant="secondary" className="mt-2">
                    需核对 {abnormalScoreCount}
                  </Badge>
                )}
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Award className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== 2. Chapter / Section Diagnostics ========== */}
      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">章节 / 小节诊断</h3>
              <p className="text-xs text-muted-foreground">
                按课程结构聚合，均分使用 score / maxScore * 100，异常分数单独标记。
              </p>
            </div>
            {abnormalScoreCount > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {abnormalScoreCount} 条需核对
              </Badge>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>章节</TableHead>
                  <TableHead>小节</TableHead>
                  <TableHead className="text-right">任务</TableHead>
                  <TableHead className="text-right">提交</TableHead>
                  <TableHead className="text-right">已批改</TableHead>
                  <TableHead className="text-right">均分</TableHead>
                  <TableHead className="text-right">质量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chapterDiagnostics.map((summary) => (
                  <TableRow key={summary.key}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {summary.chapterTitle}
                    </TableCell>
                    <TableCell className="min-w-36">
                      <div className="flex flex-col gap-1">
                        <span>{summary.sectionTitle}</span>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(summary.byType).map(([type, count]) => (
                            <Badge key={type} variant="outline" className="text-[11px]">
                              {taskTypeLabels[type] || type} {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{summary.taskCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{summary.submissionCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{summary.gradedCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {summary.validScoreCount > 0 ? `${summary.avgScore}/100` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary.abnormalCount > 0 ? (
                        <Badge variant="secondary" className="text-[11px]">
                          需核对 {summary.abnormalCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">正常</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ========== 3. Task Performance List (expandable) ========== */}
      <div>
        <h3 className="text-base font-semibold mb-3">任务明细</h3>
        <div className="space-y-2">
          {instanceStats.map((stat) => {
            const isExpanded = expandedTasks.has(stat.instanceId);
            const insights = insightsCache[stat.instanceId];
            const isLoadingInsights = insightsLoading.has(stat.instanceId);

            return (
              <Card key={stat.instanceId}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-xl"
                  onClick={() => toggleTask(stat.instanceId)}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium text-sm flex-1 truncate">
                    {stat.title}
                  </span>
                  <span className="hidden text-xs text-muted-foreground lg:inline">
                    {stat.chapterTitle} · {stat.sectionTitle}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {taskTypeLabels[stat.taskType] || stat.taskType}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    均分 <span className="font-mono font-medium text-foreground">{stat.avgScore}</span>/100
                  </span>
                  {stat.abnormalCount > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      需核对 {stat.abnormalCount}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {stat.gradedCount}/{stat.submissionCount} 已提交
                  </span>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    {stat.qualityFlags.length > 0 && (
                      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {stat.qualityFlags.join("；")}
                      </div>
                    )}
                    {isLoadingInsights && !insights && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">
                          加载详细数据...
                        </span>
                      </div>
                    )}

                    {insights && (
                      <div className="space-y-4 mt-2">
                        {/* Score distribution */}
                        {insights.stats.gradedCount > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">分数分布</p>
                            <div className="space-y-1.5">
                              {insights.distribution.map((bucket) => {
                                const maxCount = Math.max(
                                  ...insights.distribution.map((b) => b.count),
                                  1
                                );
                                return (
                                  <div
                                    key={bucket.range}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="w-16 text-xs text-right text-muted-foreground shrink-0">
                                      {bucket.range}分
                                    </span>
                                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 rounded transition-all"
                                        style={{
                                          width: `${(bucket.count / maxCount) * 100}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-8 text-xs text-muted-foreground shrink-0">
                                      {bucket.count}人
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Criteria/dimension performance */}
                        {insights.criteriaStats.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">各维度得分</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {insights.criteriaStats.map((cs) => {
                                const ratio =
                                  cs.maxPoints > 0 ? cs.avgScore / cs.maxPoints : 0;
                                return (
                                  <div
                                    key={cs.criterionId}
                                    className="rounded-lg border p-3 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium">
                                        {cs.criterionName}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {cs.avgScore}/{cs.maxPoints}
                                      </span>
                                    </div>
                                    <Progress
                                      value={Math.round(ratio * 100)}
                                      className="h-1.5"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Weak students per dimension */}
                        {insights.weaknessByDimension.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2 flex items-center gap-1">
                              <TrendingDown className="size-3.5" />
                              薄弱维度 & 学生
                            </p>
                            <div className="space-y-3">
                              {insights.weaknessByDimension.map((ws) => {
                                const ratio =
                                  ws.maxPoints > 0 ? ws.avgScore / ws.maxPoints : 0;
                                return (
                                  <div key={ws.criterionId} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-medium">
                                        {ws.criterionName}
                                      </span>
                                      <span className="text-muted-foreground">
                                        均分 {ws.avgScore}/{ws.maxPoints} (
                                        {Math.round(ratio * 100)}%)
                                      </span>
                                    </div>
                                    {ws.weakStudents.length > 0 && (
                                      <div className="space-y-0.5">
                                        {ws.weakStudents.map((student) => {
                                          const subId = findSubmissionId(
                                            insights,
                                            student.studentId
                                          );
                                          return (
                                            <button
                                              key={student.studentId}
                                              type="button"
                                              className="flex items-center gap-2 w-full text-left px-2 py-1 rounded hover:bg-muted transition-colors text-xs"
                                              disabled={!subId}
                                              onClick={() => {
                                                if (subId) {
                                                  openEvidence(
                                                    subId,
                                                    student.studentName,
                                                    ws.criterionId,
                                                    ws.criterionName
                                                  );
                                                }
                                              }}
                                            >
                                              <span className="text-muted-foreground w-20 truncate">
                                                {student.studentName}
                                              </span>
                                              <span className="font-medium">
                                                {student.score}/{student.maxScore}
                                              </span>
                                              {student.comment && (
                                                <span className="flex-1 truncate text-muted-foreground">
                                                  {student.comment}
                                                </span>
                                              )}
                                              {subId && (
                                                <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Per-instance failed rows — allSettled fallback */}
          {Array.from(failedInstanceIds).map((id) => {
            const title = failedInstanceTitles.get(id) ?? id;
            return (
              <Card key={`failed-${id}`} className="border-destructive/30 bg-destructive/5">
                <div className="px-4 py-3 flex items-center gap-3 text-sm">
                  <AlertCircle className="size-4 text-destructive shrink-0" />
                  <span className="font-medium flex-1 truncate">{title}</span>
                  <span className="text-xs text-destructive">数据加载失败，稍后重试</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* ========== 3. Student Performance Ranking ========== */}
      {studentPerformance.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3">学生表现排名</h3>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">排名</TableHead>
                    <TableHead>学生</TableHead>
                    <TableHead>提交次数</TableHead>
                    <TableHead>已批改</TableHead>
                    <TableHead>平均分</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPerformance.slice(0, 30).map((student, index) => (
                    <TableRow key={student.studentId}>
                      <TableCell>
                        {index === 0 && "🥇"}
                        {index === 1 && "🥈"}
                        {index === 2 && "🥉"}
                        {index > 2 && (
                          <span className="text-muted-foreground text-sm">
                            {index + 1}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.studentName}
                      </TableCell>
                      <TableCell>{student.submissionCount}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.gradedCount}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-medium">
                          {Math.round(student.avgScore)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== Evidence Sheet ========== */}
      <Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {evidence
                ? `${evidence.studentName} - ${evidence.criterionName}`
                : "加载中..."}
            </SheetTitle>
          </SheetHeader>
          {evidenceLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : evidence ? (
            <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
              <div className="space-y-4 pb-6">
                {/* Score summary */}
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {evidence.criterionName}
                    </span>
                    <Badge variant="outline">
                      {evidence.score}/{evidence.maxScore}
                    </Badge>
                  </div>
                  {evidence.comment && (
                    <p className="text-sm text-muted-foreground">
                      {evidence.comment}
                    </p>
                  )}
                </div>

                {/* Overall feedback */}
                {evidence.feedback && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      AI 总体评语
                    </p>
                    <p className="text-sm">{evidence.feedback}</p>
                  </div>
                )}

                {/* Transcript */}
                {evidence.transcript.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      对话记录
                    </p>
                    <div className="space-y-2">
                      {evidence.transcript.map((msg, idx) => (
                        <div
                          key={msg.id || idx}
                          className={`rounded-lg px-3 py-2 text-sm ${
                            msg.role === "student" || msg.role === "user"
                              ? "bg-blue-50 ml-6"
                              : "bg-muted mr-6"
                          }`}
                        >
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">
                            {msg.role === "student" || msg.role === "user"
                              ? "学生"
                              : "AI"}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {evidence.transcript.length === 0 && !evidence.feedback && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    暂无详细记录
                  </p>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
