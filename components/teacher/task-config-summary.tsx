"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Settings2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TaskSummary {
  id: string;
  taskName: string;
  taskType: "simulation" | "quiz" | "subjective";
  requirements: string | null;
  simulationConfig?: {
    scenario?: string | null;
    strictnessLevel?: string | null;
  } | null;
  quizConfig?: {
    mode?: string | null;
    timeLimitMinutes?: number | null;
    maxQuestions?: number | null;
  } | null;
  subjectiveConfig?: {
    allowedAttachmentTypes?: string[];
  } | null;
  scoringCriteria?: Array<{ id: string; name: string; maxPoints: number }>;
  allocationSections?: Array<{ id: string; label: string }>;
  quizQuestions?: Array<{ id: string }>;
}

const TYPE_LABEL: Record<TaskSummary["taskType"], string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

interface Props {
  taskId: string;
  /** Where to redirect back after edit save / cancel in /teacher/tasks/[id] */
  returnTo: string;
}

/**
 * Unit-FB1: instance 详情页顶部嵌入此折叠卡 — read-only 概览 + 跳转 Unit 4 编辑。
 * 编辑动作仍走 /teacher/tasks/[id]?edit=true&returnTo=...（保留 Unit 4 高危 dialog + audit）。
 * 编辑完成（保存/取消）后自动回到 returnTo URL，形成闭环。
 */
export function TaskConfigSummary({ taskId, returnTo }: Props) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "加载任务配置失败");
        return;
      }
      setTask(json.data as TaskSummary);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && !task && !loading) {
      void fetchTask();
    }
  }, [open, task, loading, fetchTask]);

  const editHref = `/teacher/tasks/${taskId}?edit=true&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <Card className="mb-3">
      <CardContent className="px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink-2">
            <Settings2 className="size-4 text-ink-4" aria-hidden />
            任务配置
            <Badge variant="outline" className="ml-1 text-[10.5px]">
              read-only 概览
            </Badge>
          </span>
          {open ? (
            <ChevronDown className="size-4 text-ink-5" />
          ) : (
            <ChevronRight className="size-4 text-ink-5" />
          )}
        </button>

        {open && (
          <div className="mt-3 space-y-3 text-[12.5px]">
            {loading && (
              <div className="flex items-center gap-2 text-ink-4">
                <Loader2 className="size-4 animate-spin" /> 加载任务配置...
              </div>
            )}
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-destructive">
                {error}
              </div>
            )}
            {task && (
              <>
                <SummaryRow
                  label="任务名"
                  value={
                    <span className="font-medium text-ink-2">
                      {task.taskName}
                    </span>
                  }
                />
                <SummaryRow
                  label="类型"
                  value={
                    <Badge variant="secondary">
                      {TYPE_LABEL[task.taskType] ?? task.taskType}
                    </Badge>
                  }
                />
                {task.requirements && (
                  <SummaryRow
                    label="要求"
                    value={
                      <span className="line-clamp-2 text-ink-3">
                        {task.requirements}
                      </span>
                    }
                  />
                )}
                {task.taskType === "quiz" && task.quizConfig && (
                  <SummaryRow
                    label="测验配置"
                    value={
                      <span className="text-ink-3">
                        模式={task.quizConfig.mode ?? "—"} · 题数=
                        {task.quizQuestions?.length ?? 0} · 时长=
                        {task.quizConfig.timeLimitMinutes ?? "—"} 分钟
                      </span>
                    }
                  />
                )}
                {task.taskType === "simulation" && task.simulationConfig && (
                  <SummaryRow
                    label="模拟配置"
                    value={
                      <span className="text-ink-3">
                        严格度={task.simulationConfig.strictnessLevel ?? "—"} ·
                        场景已配置={task.simulationConfig.scenario ? "是" : "否"}
                      </span>
                    }
                  />
                )}
                {task.taskType === "subjective" && task.subjectiveConfig && (
                  <SummaryRow
                    label="主观题配置"
                    value={
                      <span className="text-ink-3">
                        允许附件类型=
                        {task.subjectiveConfig.allowedAttachmentTypes?.join(
                          ", ",
                        ) || "无"}
                      </span>
                    }
                  />
                )}
                <SummaryRow
                  label="评分维度"
                  value={
                    <span className="text-ink-3">
                      {(task.scoringCriteria?.length ?? 0)} 项
                      {task.scoringCriteria && task.scoringCriteria.length > 0 && (
                        <>
                          {" · 总分 "}
                          {task.scoringCriteria.reduce(
                            (s, c) => s + c.maxPoints,
                            0,
                          )}
                        </>
                      )}
                    </span>
                  }
                />
                {task.taskType === "simulation" && (
                  <SummaryRow
                    label="资产配置段"
                    value={
                      <span className="text-ink-3">
                        {(task.allocationSections?.length ?? 0)} 个
                      </span>
                    }
                  />
                )}
              </>
            )}
            <div className="flex justify-end pt-1">
              <Link
                href={editHref}
                className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-deep"
              >
                编辑任务配置
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="w-[88px] shrink-0 text-[11.5px] text-ink-5">{label}</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  );
}
