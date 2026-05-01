"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AsyncJobSnapshot {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
  error?: string | null;
}

interface SubmissionProcessingCardProps {
  title: string;
  job?: AsyncJobSnapshot | null;
  pendingLabel?: string;
  pendingDescription?: string;
  onBack: () => void;
  onViewGrades?: () => void;
}

const statusCopy: Record<AsyncJobSnapshot["status"], { label: string; description: string }> = {
  queued: {
    label: "已提交，等待批改",
    description: "你的答案已经保存，系统会在后台开始分析。",
  },
  running: {
    label: "批改中",
    description: "AI 正在根据任务要求和评分标准分析你的提交。",
  },
  succeeded: {
    label: "批改完成，等待公布",
    description: "教师公布后，你可以在「我的成绩」中查看分数和反馈。",
  },
  failed: {
    label: "批改失败，等待教师处理",
    description: "提交内容已保存，教师端可以看到失败原因并重新触发批改。",
  },
  canceled: {
    label: "批改已取消",
    description: "提交内容已保存，如需处理请联系教师。",
  },
};

export function SubmissionProcessingCard({
  title,
  job,
  pendingLabel,
  pendingDescription,
  onBack,
  onViewGrades,
}: SubmissionProcessingCardProps) {
  const [currentJob, setCurrentJob] = useState<AsyncJobSnapshot | null>(() => job ?? null);

  useEffect(() => {
    if (!currentJob?.id) return;
    if (currentJob.status !== "queued" && currentJob.status !== "running") return;

    let canceled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/async-jobs/${currentJob.id}`);
        const json = await res.json();
        if (!canceled && json.success) {
          setCurrentJob(json.data as AsyncJobSnapshot);
        }
      } catch {
        // Polling is best-effort; the grade page remains the source of truth.
      }
    }, 1600);

    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [currentJob?.id, currentJob?.status]);

  const status = currentJob?.status ?? "queued";
  const copy =
    status === "queued"
      ? {
          label: pendingLabel ?? statusCopy.queued.label,
          description: pendingDescription ?? statusCopy.queued.description,
        }
      : statusCopy[status];
  const progress = Math.max(5, Math.min(100, currentJob?.progress ?? 15));

  const Icon = useMemo(() => {
    if (status === "succeeded") return CheckCircle2;
    if (status === "failed" || status === "canceled") return AlertCircle;
    if (status === "running") return Loader2;
    return Clock3;
  }, [status]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md border-line bg-surface shadow-fs">
        <CardContent className="space-y-5 pt-6 text-center">
          <div
            className={cn(
              "mx-auto grid size-14 place-items-center rounded-full",
              status === "succeeded"
                ? "bg-success-soft text-success"
                : status === "failed" || status === "canceled"
                  ? "bg-danger-soft text-danger"
                  : "bg-brand-soft text-brand",
            )}
          >
            <Icon className={cn("size-7", status === "running" && "animate-spin")} />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-ink">{copy.label}</h3>
            <p className="text-sm text-ink-4">{title}</p>
            <p className="text-sm leading-relaxed text-ink-4">{copy.description}</p>
          </div>

          {currentJob && (
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between text-xs text-ink-4">
                <span>后台任务</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper-alt">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    status === "failed" || status === "canceled" ? "bg-danger" : "bg-brand",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {currentJob.error && (
                <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
                  {currentJob.error}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={onBack}>
              返回任务
            </Button>
            {onViewGrades && (
              <Button onClick={onViewGrades}>
                查看成绩
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
