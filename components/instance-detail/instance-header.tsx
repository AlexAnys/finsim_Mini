"use client";

import Link from "next/link";
import {
  Clock,
  Users,
  Trophy,
  FileText,
  Megaphone,
  X,
  Check,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InstanceHeaderData {
  id: string;
  title: string;
  taskType: "simulation" | "quiz" | "subjective" | string;
  status: string;
  dueAt: string;
  assigned: number;
  totalPoints: number;
  course?: { id: string; title: string } | null;
  chapter?: { title: string } | null;
  section?: { title: string } | null;
  slot?: string | null;
}

export interface InstanceHeaderProps {
  instance: InstanceHeaderData;
  actionLoading: boolean;
  onPublish: () => void;
  onClose: () => void;
  onExport: () => void;
  onRemind: () => void;
  onStartGrading: () => void;
}

const typeLabels: Record<string, string> = {
  simulation: "SIMULATION",
  quiz: "QUIZ",
  subjective: "SUBJECTIVE",
};

const typeTokenClass: Record<string, string> = {
  simulation: "bg-sim-soft text-sim",
  quiz: "bg-quiz-soft text-quiz",
  subjective: "bg-subj-soft text-subj",
};

const statusLabels: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
  archived: "已归档",
};

const statusTokenClass: Record<string, string> = {
  draft: "bg-paper-alt text-ink-4",
  published: "bg-success-soft text-success-deep",
  closed: "bg-paper-alt text-ink-4",
  archived: "bg-warn-soft text-warn",
};

const slotLabels: Record<string, string> = {
  pre_class: "课前",
  in_class: "课中",
  post_class: "课后",
};

export function InstanceHeader({
  instance,
  actionLoading,
  onPublish,
  onClose,
  onExport,
  onRemind,
  onStartGrading,
}: InstanceHeaderProps) {
  const dueDate = new Date(instance.dueAt);
  const dueText = isNaN(dueDate.getTime())
    ? "-"
    : dueDate.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

  const typeKey = instance.taskType?.toLowerCase?.() || instance.taskType;
  const typeBadge = typeLabels[typeKey] || String(typeKey).toUpperCase();
  const typeCls = typeTokenClass[typeKey] || "bg-paper-alt text-ink-4";

  const statusKey = instance.status;
  const statusLabel = statusLabels[statusKey] || statusKey;
  const statusCls = statusTokenClass[statusKey] || "bg-paper-alt text-ink-4";

  const sectionMeta: string[] = [];
  if (instance.section?.title) sectionMeta.push(instance.section.title);
  if (instance.slot && slotLabels[instance.slot]) sectionMeta.push(slotLabels[instance.slot]);
  else if (instance.slot) sectionMeta.push(instance.slot);

  return (
    <div className="bg-surface border-b border-line px-6 pt-5 md:px-10 md:pt-[18px]">
      {/* Breadcrumb */}
      <nav className="mb-2 text-[11.5px] text-ink-5">
        <Link href="/teacher/courses" className="hover:text-ink-3">
          课程管理
        </Link>
        {instance.course?.title && (
          <>
            <span className="mx-[5px] opacity-50">/</span>
            <Link
              href={`/teacher/courses/${instance.course.id}`}
              className="hover:text-ink-3"
            >
              {instance.course.title}
            </Link>
          </>
        )}
        <span className="mx-[5px] opacity-50">/</span>
        <Link href="/teacher/instances" className="hover:text-ink-3">
          任务实例
        </Link>
        <span className="mx-[5px] opacity-50">/</span>
        <span className="text-ink-3">{instance.title}</span>
      </nav>

      {/* Title + meta + actions */}
      <div className="flex flex-col items-start justify-between gap-4 mb-4 md:flex-row md:gap-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-[3px] text-[10.5px] font-bold tracking-[1px] ${typeCls}`}
            >
              {typeBadge}
            </span>
            <span
              className={`rounded px-2 py-[3px] text-[10.5px] font-semibold ${statusCls}`}
            >
              {statusLabel}
            </span>
            {sectionMeta.length > 0 && (
              <span className="text-[11.5px] text-ink-5">
                {sectionMeta.join(" · ")}
              </span>
            )}
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink md:text-[26px]">
            {instance.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-4">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              截止 {dueText}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              指派 {instance.assigned} 人
            </span>
            <span className="inline-flex items-center gap-1">
              <Trophy className="size-3" />
              满分 {instance.totalPoints}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <FileText className="size-3" />
            导出成绩
          </Button>
          <Button variant="outline" size="sm" onClick={onRemind}>
            <Megaphone className="size-3" />
            催交
          </Button>
          {instance.status === "draft" && (
            <Button size="sm" onClick={onPublish} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
              发布
            </Button>
          )}
          {instance.status === "published" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <X className="size-3" />
                )}
                关闭实例
              </Button>
              <Button size="sm" onClick={onStartGrading}>
                <Check className="size-3" />
                开始批改
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
