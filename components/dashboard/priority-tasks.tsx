"use client";

import Link from "next/link";
import {
  MessageSquare,
  HelpCircle,
  FileText,
  Clock,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeDue } from "@/lib/utils/dashboard-formatters";

export interface PriorityTask {
  id: string;
  taskType: "simulation" | "quiz" | "subjective";
  taskName: string;
  courseId: string | null;
  courseTitle: string;
  chapterTitle?: string | null;
  dueAt: string | null;
  attemptsAllowed?: number | null;
  canSubmit: boolean;
  questionCount?: number | null;
}

interface PriorityTasksProps {
  tasks: PriorityTask[];
}

const TYPE_CONFIG = {
  simulation: {
    label: "模拟对话",
    icon: MessageSquare,
    soft: "bg-sim-soft",
    fg: "text-sim",
    chip: "bg-sim-soft text-sim border-sim/20",
  },
  quiz: {
    label: "测验",
    icon: HelpCircle,
    soft: "bg-quiz-soft",
    fg: "text-quiz",
    chip: "bg-quiz-soft text-quiz border-quiz/20",
  },
  subjective: {
    label: "主观题",
    icon: FileText,
    soft: "bg-subj-soft",
    fg: "text-subj",
    chip: "bg-subj-soft text-subj border-subj/20",
  },
} as const;

function taskHref(task: PriorityTask): string {
  return task.taskType === "simulation"
    ? `/sim/${task.id}`
    : `/tasks/${task.id}`;
}

export function PriorityTasks({ tasks }: PriorityTasksProps) {
  if (tasks.length === 0) {
    return (
      <section>
        <header className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink-2">优先待办</h2>
        </header>
        <div className="rounded-xl border border-line bg-surface py-6">
          <p className="text-center text-sm text-ink-4">暂无待办任务</p>
        </div>
      </section>
    );
  }

  const [first, ...rest] = tasks;
  const firstDue = first.dueAt ? formatRelativeDue(first.dueAt) : null;
  const firstCfg = TYPE_CONFIG[first.taskType];
  const FirstIcon = firstCfg.icon;
  const isUrgent = firstDue?.isUrgent ?? false;

  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">优先待办</h2>
        <span className="text-xs text-ink-4">按截止时间排序</span>
      </header>

      {/* Hero task — amber border when urgent */}
      <div
        className={cn(
          "mb-2.5 rounded-xl border bg-surface p-[18px] shadow-fs",
          isUrgent
            ? "border-warn-soft border-l-[3px] border-l-warn"
            : "border-line",
        )}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[10px]",
              firstCfg.soft,
            )}
          >
            <FirstIcon className={cn("size-[18px]", firstCfg.fg)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={firstCfg.chip}>
                {firstCfg.label}
              </Badge>
              {firstDue && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1",
                    firstDue.isUrgent
                      ? "bg-warn-soft text-warn"
                      : "bg-paper-alt text-ink-3",
                  )}
                >
                  <Clock className="size-[10px]" />
                  {firstDue.label}
                </Badge>
              )}
            </div>
            <div className="text-[15px] font-semibold text-ink">
              {first.taskName}
            </div>
            <div className="mt-1 text-[12.5px] text-ink-3">
              <span className="font-medium text-brand">
                {first.courseTitle}
              </span>
              {first.chapterTitle && (
                <>
                  <span className="mx-1.5 text-ink-5">·</span>
                  <span>{first.chapterTitle}</span>
                </>
              )}
              {first.attemptsAllowed != null && (
                <>
                  <span className="mx-1.5 text-ink-5">·</span>
                  <span>最多 {first.attemptsAllowed} 次尝试</span>
                </>
              )}
            </div>
          </div>
          <Button
            size="sm"
            disabled={!first.canSubmit}
            asChild={first.canSubmit}
          >
            {first.canSubmit ? (
              <Link href={taskHref(first)}>
                <Play className="size-[11px]" />
                开始{first.taskType === "simulation" ? "对话" : "作答"}
              </Link>
            ) : (
              <span>
                <Play className="size-[11px]" />
                开始{first.taskType === "simulation" ? "对话" : "作答"}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Rest — simple rows */}
      {rest.map((t) => {
        const cfg = TYPE_CONFIG[t.taskType];
        const RestIcon = cfg.icon;
        const dueInfo = t.dueAt ? formatRelativeDue(t.dueAt) : null;
        return (
          <div
            key={t.id}
            className="mb-2 flex items-center gap-3.5 rounded-xl border border-line bg-surface px-[18px] py-3.5"
          >
            <div
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg",
                cfg.soft,
              )}
            >
              <RestIcon className={cn("size-[15px]", cfg.fg)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-ink-2">
                {t.taskName}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-4">
                <span className="font-medium text-brand">
                  {t.courseTitle}
                </span>
                {dueInfo && (
                  <>
                    <span className="text-ink-5">·</span>
                    <span>{dueInfo.label}</span>
                  </>
                )}
                {t.questionCount != null && (
                  <>
                    <span className="text-ink-5">·</span>
                    <span>{t.questionCount} 题</span>
                  </>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!t.canSubmit}
              asChild={t.canSubmit}
            >
              {t.canSubmit ? (
                <Link href={taskHref(t)}>开始</Link>
              ) : (
                <span>开始</span>
              )}
            </Button>
          </div>
        );
      })}
    </section>
  );
}
