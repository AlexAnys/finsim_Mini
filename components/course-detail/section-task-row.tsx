"use client";

import Link from "next/link";
import {
  MessageSquare,
  HelpCircle,
  FileText,
  Check,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TaskRowStatus = "todo" | "submitted" | "grading" | "graded" | "failed" | "overdue";
export type TaskRowType = "simulation" | "quiz" | "subjective";

const TYPE_META: Record<
  TaskRowType,
  { label: string; icon: LucideIcon; soft: string; fg: string }
> = {
  simulation: {
    label: "模拟对话",
    icon: MessageSquare,
    soft: "bg-sim-soft",
    fg: "text-sim",
  },
  quiz: {
    label: "测验",
    icon: HelpCircle,
    soft: "bg-quiz-soft",
    fg: "text-quiz",
  },
  subjective: {
    label: "主观题",
    icon: FileText,
    soft: "bg-subj-soft",
    fg: "text-subj",
  },
};

export interface SectionTaskRowData {
  id: string;
  type: TaskRowType;
  title: string;
  status: TaskRowStatus;
  dueLabel?: string | null;
  scoreLabel?: string | null;
  canSubmit: boolean;
}

interface SectionTaskRowProps {
  task: SectionTaskRowData;
}

function taskHref(task: SectionTaskRowData): string {
  return task.type === "simulation"
    ? `/sim/${task.id}`
    : `/tasks/${task.id}`;
}

export function SectionTaskRow({ task }: SectionTaskRowProps) {
  const meta = TYPE_META[task.type];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-line-2 bg-surface px-3 py-2">
      <div
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md",
          meta.soft,
        )}
      >
        <Icon className={cn("size-3", meta.fg)} />
      </div>
      <div className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
        {task.title}
      </div>

      {task.status === "graded" && task.scoreLabel && (
        <Badge variant="secondary" className="gap-1 bg-success-soft text-success-deep">
          <Check className="size-[9px]" strokeWidth={2.5} />
          {task.scoreLabel}
        </Badge>
      )}
      {task.status === "todo" && task.dueLabel && (
        <Badge variant="secondary" className="gap-1 bg-warn-soft text-warn">
          <Clock className="size-[9px]" />
          {task.dueLabel}
        </Badge>
      )}
      {task.status === "submitted" && (
        <Badge
          variant="secondary"
          className="bg-paper-alt text-ink-3"
        >
          待评估
        </Badge>
      )}
      {task.status === "grading" && (
        <Badge
          variant="secondary"
          className="bg-brand-soft text-brand"
        >
          批改中
        </Badge>
      )}
      {task.status === "failed" && (
        <Badge
          variant="secondary"
          className="bg-danger-soft text-danger"
        >
          批改失败
        </Badge>
      )}
      {task.status === "overdue" && (
        <Badge variant="secondary" className="bg-danger-soft text-danger">
          已过期
        </Badge>
      )}

      {task.status === "todo" && task.canSubmit ? (
        <Button size="xs" asChild>
          <Link href={taskHref(task)}>开始</Link>
        </Button>
      ) : task.status === "graded" ? (
        <Button size="xs" variant="ghost" asChild>
          <Link href={taskHref(task)}>回顾</Link>
        </Button>
      ) : task.status === "submitted" || task.status === "grading" || task.status === "failed" ? (
        <Button size="xs" variant="ghost" asChild>
          <Link href={taskHref(task)}>查看</Link>
        </Button>
      ) : task.status === "overdue" ? null : (
        <Button size="xs" disabled>
          开始
        </Button>
      )}
    </div>
  );
}
