"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, AlertCircle, Upload, FileSearch, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ImportStage = "uploading" | "analyzing" | "extracting" | "completed" | "failed";

export interface ImportJobStatus {
  id: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  totalQuestions: number | null;
  processedQuestions: number | null;
  error: string | null;
  fileName: string;
}

export interface ImportProgressDialogProps {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  fileName: string | null;
  onComplete: (totalQuestions: number) => void;
  onRetry?: () => void;
}

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 60000;
const AUTO_CLOSE_MS = 3000;

const STAGE_CONFIG: Record<
  ImportStage,
  { label: string; description: string; icon: typeof Upload; percent: number }
> = {
  uploading: {
    label: "上传中",
    description: "正在上传 PDF 文件…",
    icon: Upload,
    percent: 15,
  },
  analyzing: {
    label: "分析中",
    description: "正在解析文档结构与文本内容…",
    icon: FileSearch,
    percent: 45,
  },
  extracting: {
    label: "拆题中",
    description: "正在提取题目并写入题库…",
    icon: ListChecks,
    percent: 75,
  },
  completed: {
    label: "完成",
    description: "题目已全部导入",
    icon: CheckCircle2,
    percent: 100,
  },
  failed: {
    label: "失败",
    description: "导入未能完成",
    icon: AlertCircle,
    percent: 0,
  },
};

export function deriveStage(job: ImportJobStatus | null, hasJobId: boolean): ImportStage {
  if (!hasJobId) return "uploading";
  if (!job) return "uploading";
  if (job.status === "uploaded") return "uploading";
  if (job.status === "failed") return "failed";
  if (job.status === "completed") return "completed";
  // status === "processing"
  if (job.totalQuestions == null) return "analyzing";
  return "extracting";
}

export function ImportProgressDialog({
  open,
  onClose,
  jobId,
  fileName,
  onComplete,
  onRetry,
}: ImportProgressDialogProps) {
  const [job, setJob] = useState<ImportJobStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reset state every time dialog opens with a new job
  useEffect(() => {
    if (open) {
      setJob(null);
      setPollError(null);
      setTimedOut(false);
      completedRef.current = false;
    }
  }, [open, jobId]);

  // Polling effect
  useEffect(() => {
    if (!open || !jobId) return;

    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      try {
        const res = await fetch(`/api/import-jobs/${jobId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          setPollError(json.error?.message || "查询导入状态失败");
          return;
        }
        const data = json.data as ImportJobStatus;
        setJob(data);

        if (data.status === "completed" && !completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current(data.totalQuestions ?? 0);
        }
      } catch {
        if (!cancelled) setPollError("网络错误，无法查询导入状态");
      }
    }

    // Immediate first poll
    poll();
    const timer = setInterval(() => {
      if (cancelled) return;
      // Stop polling when terminal state reached
      if (job?.status === "completed" || job?.status === "failed") return;
      // Timeout guard
      if (Date.now() - startedAt > TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  // Auto-close after completion
  useEffect(() => {
    if (job?.status !== "completed") return;
    const timer = setTimeout(() => {
      onClose();
    }, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [job?.status, onClose]);

  const stage = deriveStage(job, jobId !== null);
  const stageConfig = STAGE_CONFIG[stage];
  const isTerminal = stage === "completed" || stage === "failed" || timedOut;

  // Compute progress percent: when extracting, use processedQuestions / totalQuestions
  let percent = stageConfig.percent;
  if (stage === "extracting" && job?.totalQuestions && job.totalQuestions > 0) {
    const processed = job.processedQuestions ?? 0;
    // 75% baseline + 25% based on processed ratio (so it animates as questions are written)
    percent = 75 + Math.min(25, Math.round((processed / job.totalQuestions) * 25));
  }

  const stages: ImportStage[] = ["uploading", "analyzing", "extracting", "completed"];
  const activeIndex = stages.indexOf(stage);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>从 PDF 导入题目</DialogTitle>
          <DialogDescription>
            {fileName ? (
              <span className="block truncate" title={fileName}>
                {fileName}
              </span>
            ) : (
              "正在准备文件…"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Stage stepper */}
          <ol className="space-y-2">
            {stages.map((s, idx) => {
              const cfg = STAGE_CONFIG[s];
              const Icon = cfg.icon;
              const isCurrent = s === stage;
              const isDone = idx < activeIndex || stage === "completed";
              const isFailedStep = stage === "failed" && idx === activeIndex;
              const isPending = idx > activeIndex && stage !== "completed";

              return (
                <li
                  key={s}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                    isCurrent && stage !== "failed" && "bg-brand-soft/60",
                    isFailedStep && "bg-danger-soft",
                    isDone && !isCurrent && "opacity-70",
                    isPending && "opacity-40",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      isCurrent && stage !== "failed" && "bg-brand text-brand-fg",
                      isFailedStep && "bg-danger text-white",
                      isDone && !isCurrent && "bg-success text-white",
                      isPending && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isCurrent && stage !== "failed" && stage !== "completed" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{cfg.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {isCurrent && stage === "extracting" && job?.totalQuestions
                        ? `已处理 ${job.processedQuestions ?? 0} / ${job.totalQuestions} 道题`
                        : isCurrent && stage === "completed"
                          ? `成功导入 ${job?.totalQuestions ?? 0} 道题`
                          : cfg.description}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Progress bar */}
          {stage !== "failed" && (
            <Progress value={percent} className="h-1.5" />
          )}

          {/* Failure / timeout / poll error UI */}
          {stage === "failed" && (
            <div className="rounded-md border border-destructive/40 bg-danger-soft px-3 py-2 text-sm">
              <div className="font-medium text-danger">导入失败</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {job?.error || "未知错误，请重试"}
              </div>
            </div>
          )}
          {pollError && stage !== "completed" && stage !== "failed" && (
            <div className="rounded-md border border-destructive/40 bg-danger-soft px-3 py-2 text-xs text-danger">
              {pollError}
            </div>
          )}
          {timedOut && stage !== "completed" && stage !== "failed" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              处理时间较长，导入仍在后台继续。可关闭此窗口稍后查看题目列表。
            </div>
          )}
        </div>

        <DialogFooter>
          {isTerminal ? (
            stage === "failed" || (timedOut && stage !== "completed") ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  关闭
                </Button>
                {onRetry && stage === "failed" && (
                  <Button onClick={onRetry}>重试</Button>
                )}
              </>
            ) : (
              <Button onClick={onClose}>查看题目</Button>
            )
          ) : (
            <Button variant="outline" onClick={onClose}>
              在后台继续
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
