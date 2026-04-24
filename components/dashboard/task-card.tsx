"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  BookOpen,
  FileText,
  HelpCircle,
  MessageSquare,
  Play,
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

const taskTypeBadgeClass: Record<string, string> = {
  simulation: "bg-sim-soft text-sim border-sim/20",
  quiz: "bg-quiz-soft text-quiz border-quiz/20",
  subjective: "bg-subj-soft text-subj border-subj/20",
};

const taskTypeIconClass: Record<string, string> = {
  simulation: "bg-sim-soft text-sim",
  quiz: "bg-quiz-soft text-quiz",
  subjective: "bg-subj-soft text-subj",
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
  const typeBadgeClass =
    taskTypeBadgeClass[taskType] || "bg-muted text-muted-foreground border-border";
  const typeLabel = taskTypeLabels[taskType] || taskType;
  const IconComp = taskTypeIconMap[taskType] || FileText;
  const iconColorClass =
    taskTypeIconClass[taskType] || "bg-muted text-muted-foreground";

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

    const isGraded = task.studentStatus === "graded";
    const cardClass = isGraded
      ? "py-3 gap-2 bg-success-soft border-success/20"
      : "py-3 gap-2";

    const taskHref = taskType === "simulation" ? `/sim/${task.id}` : `/tasks/${task.id}`;

    const renderActionButton = () => {
      const status = task.studentStatus as string;
      if (status === "overdue") {
        return (
          <Button size="xs" disabled>
            已过期
          </Button>
        );
      }
      if (status === "graded") {
        return (
          <Button size="xs" asChild>
            <Link href={taskHref}>查看结果</Link>
          </Button>
        );
      }
      if (status === "submitted") {
        return (
          <Button size="xs" variant="secondary" asChild>
            <Link href={taskHref}>已提交，待评估</Link>
          </Button>
        );
      }
      // todo status
      if (task.canSubmit) {
        return (
          <Button size="xs" asChild>
            <Link href={taskHref}>开始作答</Link>
          </Button>
        );
      }
      return (
        <Button size="xs" disabled>
          开始作答
        </Button>
      );
    };

    return (
      <Card className={cardClass}>
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
                    <span className="fs-num text-xs font-semibold text-info">
                      {task.latestScore}/{task.latestMaxScore}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {dueDate && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    截止: {dueDate}
                  </span>
                )}
                {renderActionButton()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Teacher view
  const statusCfg = teacherStatusConfig[task.status] || teacherStatusConfig.draft;
  const submissionCount = task._count?.submissions || 0;
  const studentCount = task.class?._count?.students || 0;
  const avgScore = task.analytics?.avgScore != null ? Number(task.analytics.avgScore) : null;
  const gradedCount = task.analytics?.submissionCount || 0;
  const maxScore = task.analytics?.maxScore || 100;
  const completionRate = studentCount > 0 ? Math.round((submissionCount / studentCount) * 100) : 0;

  const completionBarColor =
    completionRate >= 80
      ? "bg-success"
      : completionRate >= 60
        ? "bg-warn"
        : completionRate > 0
          ? "bg-danger"
          : "bg-muted-foreground/30";

  // Build subtitle parts: chapter · section · slot · class
  const subtitleParts: string[] = [];
  if (task.chapter?.title) subtitleParts.push(task.chapter.title);
  if (task.section?.title) subtitleParts.push(task.section.title);
  if (task.slot && slotLabels[task.slot]) subtitleParts.push(slotLabels[task.slot]);
  if (task.class?.name) subtitleParts.push(task.class.name);

  return (
    <Card className="group py-2.5 gap-0 transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4">
        {/* Col 1: Icon */}
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconColorClass}`}>
          <IconComp className="size-4" />
        </div>

        {/* Col 2: Title + meta */}
        <div className="min-w-0 w-[280px] shrink-0">
          <p className="text-sm font-medium leading-snug truncate">{taskName}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className={`shrink-0 text-[11px] px-1.5 py-0 ${typeBadgeClass}`}>
              {typeLabel}
            </Badge>
            <Badge variant={statusCfg.variant} className="shrink-0 text-[11px] px-1.5 py-0">
              {statusCfg.label}
            </Badge>
            {subtitleParts.length > 0 && (
              <span className="truncate">{subtitleParts.join(" · ")}</span>
            )}
          </div>
        </div>

        {/* Col 3: Action buttons — in the gap, visible on hover */}
        <div className="flex-1 min-w-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150">
          <div className="grid grid-cols-3 gap-x-1 gap-y-0.5">
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2 justify-start">
              <Link href={`/teacher/instances/${task.id}`}>
                <FileText className="size-3 mr-1" />
                详情
              </Link>
            </Button>
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2 justify-start">
              <Link href={`/teacher/instances/${task.id}/insights`}>
                <BarChart3 className="size-3 mr-1" />
                洞察
              </Link>
            </Button>
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2 justify-start">
              <Link href={`/teacher/instances/${task.id}#grades`}>
                <GraduationCap className="size-3 mr-1" />
                成绩
              </Link>
            </Button>
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2 justify-start">
              <Link href={`/teacher/instances/${task.id}`}>
                <MessageSquare className="size-3 mr-1" />
                学习伙伴
              </Link>
            </Button>
            <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2 justify-start">
              <Link href={`/teacher/instances/${task.id}#discussion-section`}>
                <BookOpen className="size-3 mr-1" />
                讨论
              </Link>
            </Button>
            {(taskType === "simulation" || taskType === "quiz") && (
              <Button variant="ghost" size="xs" asChild className="h-7 text-xs px-2 justify-start">
                <Link href={taskType === "simulation" ? `/sim/${task.id}?preview=true` : `/tasks/${task.id}?preview=true`}>
                  <Play className="size-3 mr-1" />
                  测试
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Col 4: Progress (fixed width) */}
        {studentCount > 0 ? (
          <div className="shrink-0 w-28 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${completionBarColor}`}
                style={{ width: `${Math.max(completionRate, 3)}%` }}
              />
            </div>
            <span className="fs-num text-xs text-muted-foreground whitespace-nowrap">
              {completionRate}%
            </span>
          </div>
        ) : (
          <div className="shrink-0 w-28" />
        )}

        {/* Col 5: Deadline + score (fixed width) */}
        <div className="shrink-0 w-28 text-right">
          {dueDate && (
            <p className={`text-xs whitespace-nowrap ${
              isPastDue
                ? "text-danger font-medium"
                : daysRemaining !== null && daysRemaining <= 3
                  ? "text-warn"
                  : "text-muted-foreground"
            }`}>
              {isPastDue ? "已截止" : "截止"} {dueDate}
            </p>
          )}
          {avgScore !== null && gradedCount > 0 ? (
            <p className="fs-num text-xs font-semibold text-info">
              均分 {Math.round(avgScore)}/{maxScore}
            </p>
          ) : studentCount > 0 ? (
            <p className="fs-num text-xs text-muted-foreground">
              {submissionCount}/{studentCount} 已提交
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
