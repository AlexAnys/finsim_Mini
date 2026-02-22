"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Course {
  id: string;
  courseTitle: string;
  class: { id: string; name: string };
}

interface InstanceStats {
  instanceId: string;
  title: string;
  taskType: string;
  className: string;
  totalStudents: number;
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

export default function TeacherAnalyticsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [instanceStats, setInstanceStats] = useState<InstanceStats[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch("/api/lms/courses");
        const json = await res.json();
        if (json.success) {
          setCourses(json.data || []);
        }
      } catch {
        setError("加载课程列表失败");
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;

    async function fetchAnalytics() {
      try {
        // Fetch task instances for this course
        const instRes = await fetch("/api/lms/task-instances");
        const instJson = await instRes.json();
        if (!instJson.success) return;

        const instances = instJson.data || [];
        // Build stats from instances and submissions
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
            className: inst.class?.name || "",
            totalStudents: 0,
            submissionCount: subs.length,
            gradedCount: graded.length,
            avgScore:
              scores.length > 0
                ? Math.round(
                    scores.reduce((a: number, b: number) => a + b, 0) /
                      scores.length
                  )
                : 0,
            maxScore:
              graded.length > 0 ? graded[0].maxScore || 100 : 100,
            highestScore: scores.length > 0 ? Math.max(...scores) : 0,
            lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
          });

          // Aggregate student performance
          for (const sub of subs) {
            const student = sub.student;
            if (!student) continue;
            const existing = studentMap.get(student.id);
            if (existing) {
              existing.submissionCount++;
              if (sub.status === "graded") {
                existing.gradedCount++;
                existing.avgScore =
                  (existing.avgScore * (existing.gradedCount - 1) +
                    (sub.score || 0)) /
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
          Array.from(studentMap.values()).sort(
            (a, b) => b.avgScore - a.avgScore
          )
        );
      } catch {
        // silent
      }
    }

    fetchAnalytics();
  }, [selectedCourse]);

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

  const totalSubmissions = instanceStats.reduce(
    (sum, s) => sum + s.submissionCount,
    0
  );
  const totalGraded = instanceStats.reduce(
    (sum, s) => sum + s.gradedCount,
    0
  );
  const overallAvg =
    instanceStats.length > 0
      ? Math.round(
          instanceStats.reduce((sum, s) => sum + s.avgScore, 0) /
            instanceStats.filter((s) => s.gradedCount > 0).length || 0
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">数据分析</h1>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="选择课程" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.courseTitle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedCourse ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">请先选择一个课程查看分析数据</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">任务数</CardTitle>
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
                <CardTitle className="text-sm font-medium">全班均分</CardTitle>
                <Award className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallAvg}</div>
              </CardContent>
            </Card>
          </div>

          {/* Task performance table */}
          <Card>
            <CardHeader>
              <CardTitle>各任务完成情况</CardTitle>
            </CardHeader>
            <CardContent>
              {instanceStats.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  暂无任务数据
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>提交/已批</TableHead>
                      <TableHead>平均分</TableHead>
                      <TableHead>最高/最低</TableHead>
                      <TableHead>完成率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instanceStats.map((stat) => (
                      <TableRow key={stat.instanceId}>
                        <TableCell className="font-medium">{stat.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {taskTypeLabels[stat.taskType] || stat.taskType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {stat.submissionCount} / {stat.gradedCount}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{stat.avgScore}</span>
                          <span className="text-muted-foreground"> / {stat.maxScore}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600">{stat.highestScore}</span>
                          {" / "}
                          <span className="text-red-600">{stat.lowestScore}</span>
                        </TableCell>
                        <TableCell>
                          <Progress
                            value={
                              stat.submissionCount > 0
                                ? (stat.gradedCount / stat.submissionCount) * 100
                                : 0
                            }
                            className="w-20"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Student rankings */}
          <Card>
            <CardHeader>
              <CardTitle>学生表现排名</CardTitle>
            </CardHeader>
            <CardContent>
              {studentPerformance.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  暂无学生数据
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>排名</TableHead>
                      <TableHead>学生</TableHead>
                      <TableHead>提交次数</TableHead>
                      <TableHead>已批改</TableHead>
                      <TableHead>平均分</TableHead>
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
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.studentName}
                        </TableCell>
                        <TableCell>{student.submissionCount}</TableCell>
                        <TableCell>{student.gradedCount}</TableCell>
                        <TableCell>
                          <span className="font-mono font-medium">
                            {Math.round(student.avgScore)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
