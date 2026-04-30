"use client";

import { useMemo, useState } from "react";
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
  sectionTitle?: string | null;
  slot?: "pre" | "in" | "post" | null;
  dueAt: string | null;
  attemptsAllowed?: number | null;
  canSubmit: boolean;
  studentStatus: "todo" | "submitted" | "graded" | "overdue";
  attemptsUsed?: number | null;
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

const SLOT_LABELS: Record<NonNullable<PriorityTask["slot"]>, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

const STATUS_LABELS: Record<PriorityTask["studentStatus"], string> = {
  todo: "待办",
  overdue: "已过期",
  submitted: "已提交",
  graded: "已批改",
};

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待完成" },
  { key: "simulation", label: "模拟" },
  { key: "quiz", label: "测验" },
  { key: "subjective", label: "主观题" },
] as const;

type TaskFilter = (typeof FILTERS)[number]["key"];

function taskHref(task: PriorityTask): string {
  return task.taskType === "simulation"
    ? `/sim/${task.id}`
    : `/tasks/${task.id}`;
}

export function PriorityTasks({ tasks }: PriorityTasksProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === "all") return true;
      if (filter === "pending") {
        return task.studentStatus === "todo" || task.studentStatus === "overdue";
      }
      return task.taskType === filter;
    });
  }, [filter, tasks]);

  if (tasks.length === 0) {
    return (
      <section>
        <header className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink-2">学习任务</h2>
        </header>
        <div className="rounded-xl border border-line bg-surface py-6">
          <p className="text-center text-sm text-ink-4">暂无学习任务</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-2">学习任务</h2>
          <p className="mt-0.5 text-xs text-ink-4">
            按截止时间排序 · 共 {tasks.length} 项
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                filter === item.key
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-surface text-ink-4 hover:bg-surface-tint",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface py-6">
            <p className="text-center text-sm text-ink-4">当前筛选下暂无任务</p>
          </div>
        ) : (
          filteredTasks.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </div>
    </section>
  );
}

function TaskRow({ task }: { task: PriorityTask }) {
  const cfg = TYPE_CONFIG[task.taskType];
  const Icon = cfg.icon;
  const dueInfo = task.dueAt ? formatRelativeDue(task.dueAt) : null;
  const isUrgent =
    task.studentStatus === "overdue" || Boolean(dueInfo?.isUrgent);
  const metaParts = [
    task.courseTitle,
    task.chapterTitle,
    task.sectionTitle,
    task.slot ? SLOT_LABELS[task.slot] : null,
  ].filter(Boolean);

  const actionText =
    task.studentStatus === "graded"
      ? "查看结果"
      : task.studentStatus === "submitted"
        ? "查看提交"
        : task.taskType === "simulation"
          ? "开始对话"
          : "开始作答";
  const canNavigate =
    task.canSubmit ||
    task.studentStatus === "submitted" ||
    task.studentStatus === "graded";

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface p-4 shadow-fs",
        isUrgent
          ? "border-warn-soft border-l-[3px] border-l-warn"
          : "border-line",
      )}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-[10px]",
            cfg.soft,
          )}
        >
          <Icon className={cn("size-[18px]", cfg.fg)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cfg.chip}>
              {cfg.label}
            </Badge>
            <Badge variant="secondary" className="bg-paper-alt text-ink-3">
              {STATUS_LABELS[task.studentStatus]}
            </Badge>
            {dueInfo && (
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1",
                  dueInfo.isUrgent || task.studentStatus === "overdue"
                    ? "bg-warn-soft text-warn"
                    : "bg-paper-alt text-ink-3",
                )}
              >
                <Clock className="size-[10px]" />
                {dueInfo.label}
              </Badge>
            )}
          </div>
          <div className="text-[15px] font-semibold text-ink">
            {task.taskName}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-ink-3">
            {metaParts.map((part, index) => (
              <span key={`${task.id}-${part}-${index}`} className={index === 0 ? "font-medium text-brand" : ""}>
                {index > 0 && <span className="mr-1.5 text-ink-5">·</span>}
                {part}
              </span>
            ))}
            {task.attemptsAllowed != null && (
              <span>
                <span className="mr-1.5 text-ink-5">·</span>
                {task.attemptsUsed ?? 0}/{task.attemptsAllowed} 次尝试
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={task.studentStatus === "todo" ? "default" : "secondary"}
          disabled={!canNavigate}
          asChild={canNavigate}
        >
          {canNavigate ? (
            <Link href={taskHref(task)}>
              <Play className="size-[11px]" />
              {actionText}
            </Link>
          ) : (
            <span>
              <Play className="size-[11px]" />
              {actionText}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
