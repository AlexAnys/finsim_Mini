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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

interface InstanceStats {
  instanceId: string;
  title: string;
  taskType: string;
  submissionCount: number;
  gradedCount: number;
  avgScore: number;
  maxScore: number;
  totalStudents: number;
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

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

// --- Component ---

export function CourseAnalyticsTab({ courseId }: CourseAnalyticsTabProps) {
  // Summary data
  const [instanceStats, setInstanceStats] = useState<InstanceStats[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

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
      const stats: InstanceStats[] = [];
      const studentMap = new Map<string, StudentPerformance>();

      for (const inst of instances) {
        const subsRes = await fetch(
          `/api/submissions?taskInstanceId=${inst.id}&pageSize=200`
        );
        const subsJson = await subsRes.json();
        const subs = subsJson.data?.items || subsJson.data || [];

        const graded = subs.filter(
          (s: { status: string }) => s.status === "graded"
        );
        const scores = graded
          .filter((s: { score: number | null }) => s.score !== null)
          .map((s: { score: number }) => s.score);

        stats.push({
          instanceId: inst.id,
          title: inst.title,
          taskType: inst.task?.taskType || inst.taskType || "",
          submissionCount: subs.length,
          gradedCount: graded.length,
          avgScore:
            scores.length > 0
              ? Math.round(
                  scores.reduce((a: number, b: number) => a + b, 0) / scores.length
                )
              : 0,
          maxScore: graded.length > 0 ? graded[0].maxScore || 100 : 100,
          totalStudents: subs.length,
        });

        for (const sub of subs) {
          const student = sub.student;
          if (!student) continue;
          const existing = studentMap.get(student.id);
          if (existing) {
            existing.submissionCount++;
            if (sub.status === "graded") {
              existing.gradedCount++;
              existing.avgScore =
                (existing.avgScore * (existing.gradedCount - 1) + (sub.score || 0)) /
                existing.gradedCount;
            }
          } else {
            studentMap.set(student.id, {
              studentId: student.id,
              studentName: student.name || "未知",
              submissionCount: 1,
              avgScore: sub.score || 0,
              gradedCount: sub.status === "graded" ? 1 : 0,
            });
          }
        }
      }

      setInstanceStats(stats);
      setStudentPerformance(
        Array.from(studentMap.values()).sort((a, b) => b.avgScore - a.avgScore)
      );
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

  // --- Empty state ---
  if (instanceStats.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="size-10 text-muted-foreground mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">暂无分析数据</p>
      </div>
    );
  }

  // --- Computed summary ---
  const totalSubmissions = instanceStats.reduce((s, i) => s + i.submissionCount, 0);
  const totalGraded = instanceStats.reduce((s, i) => s + i.gradedCount, 0);
  const gradedStats = instanceStats.filter((s) => s.gradedCount > 0);
  const overallAvg =
    gradedStats.length > 0
      ? Math.round(gradedStats.reduce((s, i) => s + i.avgScore, 0) / gradedStats.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* ========== 1. Course-level Summary Cards ========== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">任务总数</CardTitle>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{instanceStats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总提交</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubmissions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">已批改</CardTitle>
            <TrendingUp className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalGraded}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">均分</CardTitle>
            <Award className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallAvg}</div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ========== 2. Task Performance List (expandable) ========== */}
      <div>
        <h3 className="text-base font-semibold mb-3">各任务表现详情</h3>
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
                  <Badge variant="outline" className="text-xs shrink-0">
                    {taskTypeLabels[stat.taskType] || stat.taskType}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    均分 <span className="font-mono font-medium text-foreground">{stat.avgScore}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {stat.gradedCount}/{stat.submissionCount} 已提交
                  </span>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
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
