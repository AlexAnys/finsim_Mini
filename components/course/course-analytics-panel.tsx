"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  BarChart3,
  Users,
  TrendingUp,
  Award,
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

interface InstanceStats {
  instanceId: string;
  title: string;
  taskType: string;
  submissionCount: number;
  gradedCount: number;
  avgScore: number;
  maxScore: number;
  highestScore: number;
  lowestScore: number;
}

interface StudentPerformance {
  studentId: string;
  studentName: string;
  submissionCount: number;
  avgScore: number;
  gradedCount: number;
}

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

export function CourseAnalyticsPanel({ courseId }: { courseId: string }) {
  const [instanceStats, setInstanceStats] = useState<InstanceStats[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const instRes = await fetch(`/api/lms/task-instances?courseId=${courseId}`);
        const instJson = await instRes.json();
        if (!instJson.success) return;

        const instances = instJson.data || [];
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
            highestScore: scores.length > 0 ? Math.max(...scores) : 0,
            lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
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
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载分析数据...</span>
      </div>
    );
  }

  const totalSubmissions = instanceStats.reduce((s, i) => s + i.submissionCount, 0);
  const totalGraded = instanceStats.reduce((s, i) => s + i.gradedCount, 0);
  const gradedStats = instanceStats.filter((s) => s.gradedCount > 0);
  const overallAvg =
    gradedStats.length > 0
      ? Math.round(gradedStats.reduce((s, i) => s + i.avgScore, 0) / gradedStats.length)
      : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium">任务数</CardTitle>
            <BarChart3 className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{instanceStats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium">总提交</CardTitle>
            <Users className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{totalSubmissions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium">已批改</CardTitle>
            <TrendingUp className="size-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold text-green-600">{totalGraded}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium">全班均分</CardTitle>
            <Award className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{overallAvg}</div>
          </CardContent>
        </Card>
      </div>

      {/* Task performance table */}
      {instanceStats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">各任务完成情况</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>提交/批改</TableHead>
                <TableHead>均分</TableHead>
                <TableHead>完成率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instanceStats.map((stat) => (
                <TableRow key={stat.instanceId}>
                  <TableCell className="font-medium text-xs">{stat.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {taskTypeLabels[stat.taskType] || stat.taskType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {stat.submissionCount}/{stat.gradedCount}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{stat.avgScore}</TableCell>
                  <TableCell>
                    <Progress
                      value={
                        stat.submissionCount > 0
                          ? (stat.gradedCount / stat.submissionCount) * 100
                          : 0
                      }
                      className="w-16"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Student rankings */}
      {studentPerformance.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">学生表现排名</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>排名</TableHead>
                <TableHead>学生</TableHead>
                <TableHead>提交</TableHead>
                <TableHead>均分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentPerformance.slice(0, 20).map((student, index) => (
                <TableRow key={student.studentId}>
                  <TableCell>
                    {index < 3 ? (
                      <Badge
                        variant="default"
                        className={
                          index === 0
                            ? "bg-yellow-500"
                            : index === 1
                            ? "bg-gray-400"
                            : "bg-amber-600"
                        }
                      >
                        {index + 1}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">{index + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-xs">{student.studentName}</TableCell>
                  <TableCell className="text-xs">{student.submissionCount}</TableCell>
                  <TableCell className="text-xs font-mono">{Math.round(student.avgScore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {instanceStats.length === 0 && (
        <div className="text-center py-8">
          <BarChart3 className="size-10 text-muted-foreground mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">暂无分析数据</p>
        </div>
      )}
    </div>
  );
}
