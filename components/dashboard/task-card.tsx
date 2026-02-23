"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  BookOpen,
  Clock,
  FileText,
  HelpCircle,
  MessageSquare,
  Play,
  Users,
  Download,
  GraduationCap,
} from "lucide-react";

const slotLabels: Record<string, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const taskTypeColors: Record<string, string> = {
  simulation: "bg-purple-50 text-purple-700 border-purple-200",
  quiz: "bg-blue-50 text-blue-700 border-blue-200",
  subjective: "bg-teal-50 text-teal-700 border-teal-200",
};

const taskTypeIconColors: Record<string, string> = {
  simulation: "bg-purple-50 text-purple-600",
  quiz: "bg-blue-50 text-blue-600",
  subjective: "bg-teal-50 text-teal-600",
};

const taskTypeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

const studentStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  todo: { label: "待办", variant: "outline" },
  submitted: { label: "已提交", variant: "secondary" },
  graded: { label: "已批改", variant: "default" },
  overdue: { label: "已过期", variant: "destructive" },
};

const teacherStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "草稿", variant: "outline" },
  published: { label: "已发布", variant: "default" },
  closed: { label: "已关闭", variant: "secondary" },
};

interface TaskCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: Record<string, any>;
  role: "student" | "teacher";
}

export function TaskCard({ task, role }: TaskCardProps) {
  const taskType = task.task?.taskType || task.taskType || "";
  const taskName = task.title || task.task?.taskName || "";
  const typeBadgeClass = taskTypeColors[taskType] || "bg-gray-50 text-gray-700 border-gray-200";
  const typeLabel = taskTypeLabels[taskType] || taskType;
  const IconComp = taskTypeIconMap[taskType] || FileText;
  const iconColorClass = taskTypeIconColors[taskType] || "bg-blue-50 text-blue-600";

  const dueDate = task.dueAt
    ? new Date(task.dueAt).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const now = new Date();
  const isPastDue = task.dueAt ? new Date(task.dueAt) < now : false;
  const daysRemaining = task.dueAt
    ? Math.ceil((new Date(task.dueAt).getTime() - now.getTime()) / 86400000)
    : null;

  if (role === "student") {
    const statusCfg = studentStatusConfig[task.studentStatus] || studentStatusConfig.todo;
    const showScore =
      task.studentStatus === "graded" &&
      isPastDue &&
      task.latestScore !== null &&
      task.latestScore !== undefined;

    return (
      <Card className="py-3 gap-2">
        <CardContent className="flex items-start gap-3">
          <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${iconColorClass}`}>
            <IconComp className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-medium leading-tight">{taskName}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={`text-xs px-1.5 py-0 ${typeBadgeClass}`}>
                    {typeLabel}
                  </Badge>
                  <Badge variant={statusCfg.variant} className="text-xs px-1.5 py-0">
                    {statusCfg.label}
                  </Badge>
                  {showScore && (
                    <span className="text-xs font-semibold text-blue-600">
                      {task.latestScore}/{task.latestMaxScore}
                    </span>
                  )}
                  {task.chapter?.title && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                      {task.chapter.title}
                    </Badge>
                  )}
                  {task.section?.title && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 bg-cyan-50 text-cyan-700 border-cyan-200">
                      {task.section.title}
                    </Badge>
                  )}
                  {task.slot && slotLabels[task.slot] && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                      {slotLabels[task.slot]}
                    </Badge>
                  )}
                </div>
              </div>
              {task.canSubmit && (
                <Button size="xs" asChild className="shrink-0">
                  <Link href={`/tasks/${task.id}`}>开始作答</Link>
                </Button>
              )}
            </div>
            {dueDate && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                <span>截止: {dueDate}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Teacher view
  const statusCfg = teacherStatusConfig[task.status] || teacherStatusConfig.draft;
  const submissionCount = task._count?.submissions || 0;
  const className = task.class?.name || "";
  const studentCount = task.class?._count?.students || 0;
  const avgScore = task.analytics?.avgScore != null ? Number(task.analytics.avgScore) : null;
  const gradedCount = task.analytics?.submissionCount || 0;
  const maxScore = task.analytics?.maxScore || 100;
  const completionRate = studentCount > 0 ? Math.round((submissionCount / studentCount) * 100) : 0;

  return (
    <Card className="py-3 gap-2">
      <CardContent className="flex items-start gap-3">
        <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${iconColorClass}`}>
          <IconComp className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-medium leading-tight">{taskName}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${typeBadgeClass}`}>
                  {typeLabel}
                </Badge>
                <Badge variant={statusCfg.variant} className="text-xs px-1.5 py-0">
                  {statusCfg.label}
                </Badge>
                {className && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    <Users className="size-2.5 mr-0.5" />
                    {className}
                  </Badge>
                )}
                {task.chapter?.title && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                    {task.chapter.title}
                  </Badge>
                )}
                {task.section?.title && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 bg-cyan-50 text-cyan-700 border-cyan-200">
                    {task.section.title}
                  </Badge>
                )}
                {task.slot && slotLabels[task.slot] && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                    {slotLabels[task.slot]}
                  </Badge>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {studentCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {submissionCount}/{studentCount} 完成 {completionRate}%
                </span>
              )}
              {avgScore !== null && gradedCount > 0 && (
                <p className="text-sm font-semibold text-blue-600">
                  均分 {Math.round(avgScore)}/{maxScore}
                </p>
              )}
            </div>
          </div>

          {/* Score progress bar for graded submissions */}
          {avgScore !== null && gradedCount > 0 && maxScore > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${
                    avgScore / maxScore > 0.7
                      ? "bg-green-500"
                      : avgScore / maxScore >= 0.5
                        ? "bg-orange-500"
                        : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min((avgScore / maxScore) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {gradedCount} 已批改
              </span>
            </div>
          )}

          {dueDate && (
            <div className={`mt-1.5 flex items-center gap-1 text-xs ${
              isPastDue
                ? "text-red-500"
                : daysRemaining !== null && daysRemaining <= 3
                  ? "text-orange-500"
                  : "text-muted-foreground"
            }`}>
              <Clock className="size-3" />
              <span>
                {isPastDue
                  ? `已截止: ${dueDate}`
                  : daysRemaining !== null && daysRemaining <= 3
                    ? `剩余 ${daysRemaining} 天 - ${dueDate}`
                    : `截止: ${dueDate}`
                }
              </span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2.5">
              <Link href={`/teacher/instances/${task.id}`}>
                <FileText className="size-3 mr-0.5" />
                详情
              </Link>
            </Button>
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2.5">
              <Link href={`/teacher/instances/${task.id}/insights`}>
                <BarChart3 className="size-3 mr-0.5" />
                洞察
              </Link>
            </Button>
            {submissionCount > 0 && (
              <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2.5">
                <Link href={`/teacher/instances/${task.id}#grades`}>
                  <GraduationCap className="size-3 mr-0.5" />
                  成绩
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2.5">
              <Link href={`/teacher/instances/${task.id}`}>
                <MessageSquare className="size-3 mr-0.5" />
                学习伙伴
              </Link>
            </Button>
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2.5">
              <Link href={`/teacher/instances/${task.id}#discussion-section`}>
                <BookOpen className="size-3 mr-0.5" />
                讨论
              </Link>
            </Button>
            {taskType === "simulation" && (
              <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2.5">
                <Link href={`/sim/${task.id}?preview=true`}>
                  <Play className="size-3 mr-0.5" />
                  测试
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
