"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Trophy, FileText, MessageSquare, HelpCircle } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Submission {
  id: string;
  taskId: string;
  taskInstanceId: string;
  taskType: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  evaluation: Record<string, unknown> | null;
  submittedAt: string;
  gradedAt: string | null;
  task: {
    id: string;
    taskName: string;
    taskType: string;
  };
  taskInstance: {
    id: string;
    title: string;
  };
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  submitted: { label: "批改中", variant: "secondary" },
  grading: { label: "批改中", variant: "secondary" },
  graded: { label: "已批改", variant: "default" },
  failed: { label: "批改失败", variant: "destructive" },
};

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

function EvaluationDetail({ submission }: { submission: Submission }) {
  if (!submission.evaluation) return <p className="text-sm text-muted-foreground">暂无评估详情</p>;

  const eval_ = submission.evaluation as {
    feedback?: string;
    rubricBreakdown?: Array<{ criterionId: string; score: number; maxScore: number; comment: string }>;
    quizBreakdown?: Array<{ questionId: string; score: number; maxScore: number; correct: boolean; comment: string }>;
  };

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-blue-600">{submission.score}</div>
        <div className="text-lg text-muted-foreground">/ {submission.maxScore}</div>
        {submission.maxScore && submission.score !== null && (
          <Progress
            value={(submission.score / submission.maxScore) * 100}
            className="flex-1"
          />
        )}
      </div>

      {/* Feedback */}
      {eval_.feedback && (
        <div>
          <h4 className="mb-1 text-sm font-medium">总体评语</h4>
          <p className="text-sm text-muted-foreground">{eval_.feedback}</p>
        </div>
      )}

      <Separator />

      {/* Rubric breakdown */}
      {eval_.rubricBreakdown && eval_.rubricBreakdown.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">评分明细</h4>
          <div className="space-y-2">
            {eval_.rubricBreakdown.map((rb, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{rb.criterionId}</span>
                  <Badge variant="outline">{rb.score}/{rb.maxScore}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{rb.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz breakdown */}
      {eval_.quizBreakdown && eval_.quizBreakdown.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">题目明细</h4>
          <div className="space-y-2">
            {eval_.quizBreakdown.map((qb, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                <Badge variant={qb.correct ? "default" : "destructive"}>
                  {qb.correct ? "正确" : "错误"}
                </Badge>
                <div className="flex-1">
                  <span className="text-sm">第 {i + 1} 题</span>
                  <p className="text-xs text-muted-foreground">{qb.comment}</p>
                </div>
                <span className="text-sm font-mono">{qb.score}/{qb.maxScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentGradesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const res = await fetch("/api/submissions?pageSize=100");
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || "加载失败");
          return;
        }
        setSubmissions(json.data.items || json.data || []);
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, []);

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

  const filteredSubmissions = activeTab === "all"
    ? submissions
    : submissions.filter((s) => s.taskType === activeTab);

  const gradedSubmissions = submissions.filter((s) => s.status === "graded" && s.score !== null);
  const avgScore = gradedSubmissions.length > 0
    ? Math.round(gradedSubmissions.reduce((sum, s) => sum + ((s.score! / (s.maxScore || 1)) * 100), 0) / gradedSubmissions.length)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">我的成绩</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总提交数</p>
                <p className="text-2xl font-bold mt-1">{submissions.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已批改</p>
                <p className="text-2xl font-bold mt-1">{gradedSubmissions.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均分</p>
                <p className="text-2xl font-bold mt-1">{avgScore}%</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions table */}
      <Card>
        <CardHeader>
          <CardTitle>提交记录</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="simulation">模拟对话</TabsTrigger>
              <TabsTrigger value="quiz">测验</TabsTrigger>
              <TabsTrigger value="subjective">主观题</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              {filteredSubmissions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">暂无提交记录</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>提交时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>成绩</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((sub) => {
                      const Icon = taskTypeIcons[sub.taskType] || FileText;
                      const statusCfg = statusLabels[sub.status] || statusLabels.submitted;
                      return (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">
                            {sub.task?.taskName || sub.taskInstance?.title || "-"}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Icon className="size-3" />
                              {taskTypeLabels[sub.taskType] || sub.taskType}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(sub.submittedAt).toLocaleString("zh-CN")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {sub.status === "graded" && sub.score !== null ? (
                              <span className="font-mono font-medium">
                                {sub.score}/{sub.maxScore}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.status === "graded" && sub.evaluation && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">详情</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh]">
                                  <DialogHeader>
                                    <DialogTitle>
                                      {sub.task?.taskName || "评估详情"}
                                    </DialogTitle>
                                  </DialogHeader>
                                  <ScrollArea className="max-h-[60vh]">
                                    <EvaluationDetail submission={sub} />
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
