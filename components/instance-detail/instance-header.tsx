"use client";

import { useEffect, useRef, useState } from "react";
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
  RotateCcw,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  submissionCount?: number;
  onPublish: () => void;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onExport: () => void;
  onRemind: () => void;
  onStartGrading: () => void;
  onTitleSave?: (nextTitle: string) => Promise<void>;
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

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const startEdit = () => {
    setDraft(value);
    setError(null);
    setIsEditing(true);
  };

  const cancel = () => {
    setIsEditing(false);
    setDraft(value);
    setError(null);
  };

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError("标题不能为空");
      return;
    }
    if (trimmed.length > 200) {
      setError("标题不能超过 200 字");
      return;
    }
    if (trimmed === value) {
      cancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      // 父组件已 toast；保持编辑态让用户重试
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink md:text-[26px]">
          {value}
        </h1>
        <button
          type="button"
          aria-label="编辑标题"
          onClick={startEdit}
          className="inline-flex size-7 items-center justify-center rounded text-ink-5 hover:bg-paper-alt hover:text-ink-3"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !composingRef.current) {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          disabled={saving}
          maxLength={200}
          className="h-9 max-w-[480px] text-[18px] font-semibold md:text-[22px]"
        />
        <Button
          size="sm"
          onClick={() => void commit()}
          disabled={saving}
          aria-label="保存标题"
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          保存
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={cancel}
          disabled={saving}
          aria-label="取消编辑"
        >
          <X className="size-3" />
          取消
        </Button>
      </div>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}

export function InstanceHeader({
  instance,
  actionLoading,
  submissionCount = 0,
  onPublish,
  onClose,
  onReopen,
  onDelete,
  onExport,
  onRemind,
  onStartGrading,
  onTitleSave,
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
          {onTitleSave ? (
            <EditableTitle value={instance.title} onSave={onTitleSave} />
          ) : (
            <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink md:text-[26px]">
              {instance.title}
            </h1>
          )}
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
          {instance.status === "closed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onReopen}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                重新开放
              </Button>
              {submissionCount > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="text-destructive opacity-50"
                      >
                        <Trash2 className="size-3" />
                        删除实例
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    已有学生提交，无法删除
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  disabled={actionLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                  删除实例
                </Button>
              )}
            </>
          )}
          {instance.status === "draft" && submissionCount === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={actionLoading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3" />
              删除实例
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
