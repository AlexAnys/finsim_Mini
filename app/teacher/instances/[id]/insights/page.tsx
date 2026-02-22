"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Users,
  Award,
  TrendingDown,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface InsightsInstance {
  id: string;
  title: string;
  taskType: string;
  status: string;
  className: string;
}

interface InsightsStats {
  totalSubmissions: number;
  gradedCount: number;
  avgScore: number;
  maxScore: number;
  highestScore: number;
  lowestScore: number;
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
  instance: InsightsInstance;
  stats: InsightsStats;
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

// --- Component ---

export default function InsightsPage() {
  const params = useParams();
  const instanceId = params.id as string;

  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expandable buckets
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());

  // Evidence drawer state
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/lms/task-instances/${instanceId}/insights`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载失败");
        return;
      }
      setData(json.data);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleBucket(range: string) {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(range)) {
        next.delete(range);
      } else {
        next.add(range);
      }
      return next;
    });
  }

  async function openEvidence(
    submissionId: string,
    studentName: string,
    criterionId: string,
    criterionName: string
  ) {
    setEvidenceOpen(true);
    setEvidenceLoading(true);
    setEvidence(null);

    try {
      const res = await fetch(`/api/submissions/${submissionId}`);
      const json = await res.json();
      if (!json.success) {
        toast.error("加载提交详情失败");
        setEvidenceOpen(false);
        return;
      }

      const sub = json.data;
      let transcript: TranscriptMessage[] = [];
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
      let feedback = evaluation?.feedback || "";

      if (evaluation?.rubricBreakdown) {
        const bd = evaluation.rubricBreakdown.find(
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
  }

  // Find submission ID for a student
  function findSubmissionId(studentId: string): string | null {
    if (!data) return null;
    const sub = data.submissions.find(
      (s) => s.studentId === studentId && s.status === "graded"
    );
    return sub?.id || null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { instance, stats, distribution, criteriaStats, weaknessByDimension } = data;
  const maxBucketCount = Math.max(...distribution.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/teacher/instances" className="hover:text-foreground">
          任务实例
        </Link>
        <ChevronRight className="size-4" />
        <Link
          href={`/teacher/instances/${instanceId}`}
          className="hover:text-foreground"
        >
          {instance.title}
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">教学洞察</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="size-6" />
            教学洞察
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {instance.title} - {instance.className}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/teacher/instances/${instanceId}`}>返回详情</Link>
        </Button>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              提交总数
            </div>
            <p className="mt-1 text-2xl font-bold">{stats.totalSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Award className="size-4" />
              已批改
            </div>
            <p className="mt-1 text-2xl font-bold">{stats.gradedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="size-4" />
              均分
            </div>
            <p className="mt-1 text-2xl font-bold">
              {stats.avgScore}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {stats.maxScore}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="size-4" />
              最高/最低分
            </div>
            <p className="mt-1 text-2xl font-bold">
              {stats.highestScore}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {stats.lowestScore}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">分数分布</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.gradedCount === 0 ? (
            <p className="text-sm text-muted-foreground">暂无已批改提交</p>
          ) : (
            distribution.map((bucket) => (
              <div key={bucket.range}>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => bucket.count > 0 && toggleBucket(bucket.range)}
                >
                  <span className="w-16 text-xs text-right text-muted-foreground shrink-0">
                    {bucket.range}分
                  </span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded transition-all"
                      style={{
                        width: `${maxBucketCount > 0 ? (bucket.count / maxBucketCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground shrink-0">
                    {bucket.count}人
                  </span>
                  {bucket.count > 0 && (
                    <ChevronDown
                      className={`size-3 text-muted-foreground transition-transform ${
                        expandedBuckets.has(bucket.range) ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>
                {expandedBuckets.has(bucket.range) && bucket.students.length > 0 && (
                  <div className="ml-18 mt-1 mb-2 pl-4 border-l-2 border-muted space-y-0.5">
                    {bucket.students.map((s) => (
                      <div
                        key={s.id}
                        className="text-xs text-muted-foreground flex items-center gap-2"
                      >
                        <span>{s.name}</span>
                        <span className="font-medium text-foreground">
                          {s.score}分
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Criteria Performance */}
      {criteriaStats.length > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">各维度得分表现</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {criteriaStats.map((cs) => {
                  const ratio =
                    cs.maxPoints > 0 ? cs.avgScore / cs.maxPoints : 0;
                  const colorClass =
                    ratio > 0.7
                      ? "bg-green-500"
                      : ratio >= 0.5
                        ? "bg-orange-500"
                        : "bg-red-500";
                  const textColorClass =
                    ratio > 0.7
                      ? "text-green-600"
                      : ratio >= 0.5
                        ? "text-orange-600"
                        : "text-red-600";

                  return (
                    <div
                      key={cs.criterionId}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {cs.criterionName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          满分 {cs.maxPoints}
                        </Badge>
                      </div>
                      {cs.description && (
                        <p className="text-xs text-muted-foreground">
                          {cs.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all ${colorClass}`}
                            style={{
                              width: `${Math.round(ratio * 100)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold ${textColorClass}`}
                        >
                          {cs.avgScore}/{cs.maxPoints}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Weakness Rankings */}
      {weaknessByDimension.length > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="size-4" />
                薄弱维度排名
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {weaknessByDimension.map((ws) => {
                const ratio =
                  ws.maxPoints > 0 ? ws.avgScore / ws.maxPoints : 0;

                return (
                  <div key={ws.criterionId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {ws.criterionName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        均分 {ws.avgScore}/{ws.maxPoints} (
                        {Math.round(ratio * 100)}%)
                      </span>
                    </div>
                    {ws.weakStudents.length > 0 && (
                      <div className="space-y-1">
                        {ws.weakStudents.map((student) => {
                          const subId = findSubmissionId(student.studentId);
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
                    <Separator />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {/* Evidence Drawer */}
      <Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {evidence ? `${evidence.studentName} - ${evidence.criterionName}` : "加载中..."}
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
                    <span className="text-sm font-medium">{evidence.criterionName}</span>
                    <Badge variant="outline">
                      {evidence.score}/{evidence.maxScore}
                    </Badge>
                  </div>
                  {evidence.comment && (
                    <p className="text-sm text-muted-foreground">{evidence.comment}</p>
                  )}
                </div>

                {/* Overall feedback */}
                {evidence.feedback && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">AI 总体评语</p>
                    <p className="text-sm">{evidence.feedback}</p>
                  </div>
                )}

                {/* Transcript */}
                {evidence.transcript.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">对话记录</p>
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
