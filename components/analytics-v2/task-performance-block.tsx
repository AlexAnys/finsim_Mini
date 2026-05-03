"use client";

import { useMemo } from "react";
import { ArrowRight, ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ScopeSimulationHighlight,
  ScopeSimulationInsight,
  ScopeSimulationIssue,
} from "@/lib/services/scope-insights.service";
import type { EvidenceItem } from "@/components/analytics-v2/evidence-drawer";

interface TaskOption {
  id: string;
  title: string;
  className: string;
}

interface Props {
  data: ScopeSimulationInsight | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpenEvidence?: (evidence: EvidenceItem) => void;
  taskOptions?: TaskOption[];
  selectedTaskId?: string;
  onTaskChange?: (taskId: string) => void;
}

const ALL_TASKS = "__all__";

export function TaskPerformanceBlock({
  data,
  loading,
  refreshing,
  onRefresh,
  onOpenEvidence,
  taskOptions = [],
  selectedTaskId,
  onTaskChange,
}: Props) {
  const filteredHighlights = useMemo(() => {
    const all = data?.highlights ?? [];
    if (!selectedTaskId || selectedTaskId === ALL_TASKS) return all;
    return all.filter((h) => h.taskInstanceId === selectedTaskId);
  }, [data, selectedTaskId]);
  const filteredIssues = useMemo(() => {
    const all = data?.commonIssues ?? [];
    if (!selectedTaskId || selectedTaskId === ALL_TASKS) return all;
    return all.filter((issue) =>
      issue.evidence.some((e) => e.taskInstanceId === selectedTaskId),
    );
  }, [data, selectedTaskId]);

  const isEmpty =
    !loading &&
    !refreshing &&
    filteredHighlights.length === 0 &&
    filteredIssues.length === 0;
  const generatedLabel = data?.generatedAt ? formatDateTime(data.generatedAt) : null;
  const sourceLabel = data?.source === "cache" ? "缓存" : data?.source === "fallback" ? "降级" : "已生成";
  const detailHref = selectedTaskId && selectedTaskId !== ALL_TASKS
    ? `/teacher/instances/${selectedTaskId}/insights`
    : null;

  return (
    <Card className="rounded-lg flex h-full flex-col overflow-hidden">
      <CardHeader className="space-y-2 pb-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Sparkles className="size-3.5 text-brand" />
              任务表现 (Simulation)
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {generatedLabel ? `${sourceLabel} · ${generatedLabel}` : "尚未生成"}
              {data?.notice ? ` · ${data.notice}` : ""}
            </p>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={onRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              重新生成
            </Button>
          )}
        </div>
        {taskOptions.length > 0 && onTaskChange && (
          <Select
            value={selectedTaskId || ALL_TASKS}
            onValueChange={(v) => onTaskChange(v === ALL_TASKS ? "" : v)}
          >
            <SelectTrigger size="sm" className="h-7 w-full rounded-md text-xs">
              <SelectValue placeholder="全部任务" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TASKS}>全部 simulation 任务</SelectItem>
              {taskOptions.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title} · {task.className}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0 pb-3 px-4">
        {loading ? (
          <LoadingState />
        ) : isEmpty ? (
          <EmptyPanel icon={Sparkles} title="任务表现 · 暂无数据" description="当前范围无 simulation graded 数据；请扩大筛选范围或先批改若干 simulation 提交。" />
        ) : (
          <div className="space-y-3">
            <SectionInline
              tone="success"
              label="高分典型"
              count={filteredHighlights.length}
            >
              {filteredHighlights.length === 0 ? (
                <EmptyHint text="当前范围暂无高分典型样本" />
              ) : (
                filteredHighlights.slice(0, 4).map((h) => (
                  <HighlightRow
                    key={h.submissionId}
                    data={h}
                    onClick={() => onOpenEvidence?.({ type: "highlight", data: h })}
                  />
                ))
              )}
            </SectionInline>

            <SectionInline
              tone="destructive"
              label="低分共性问题"
              count={filteredIssues.length}
            >
              {filteredIssues.length === 0 ? (
                <EmptyHint text="当前范围暂无低分共性问题" />
              ) : (
                filteredIssues.slice(0, 4).map((issue, idx) => (
                  <IssueRow
                    key={`${issue.title}-${idx}`}
                    data={issue}
                    onClick={() => onOpenEvidence?.({ type: "issue", data: issue })}
                  />
                ))
              )}
            </SectionInline>

            {detailHref && (
              <Link
                href={detailHref}
                className="inline-flex items-center gap-0.5 pt-1 text-[11px] text-brand hover:underline"
              >
                查看任务详情 <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionInline({
  tone,
  label,
  count,
  children,
}: {
  tone: "success" | "destructive";
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const sectionStyle =
    tone === "success"
      ? "border-l-2 border-success bg-success/5"
      : "border-l-2 border-destructive bg-destructive/5";
  return (
    <div className={`rounded-md ${sectionStyle} px-3 py-2 space-y-1.5`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Badge variant="outline" className="rounded-md text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function HighlightRow({
  data,
  onClick,
}: {
  data: ScopeSimulationHighlight;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md bg-background px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="truncate">{data.studentName}</span>
        </div>
        <p className="line-clamp-1 text-[11px] text-muted-foreground">{data.reason}</p>
      </div>
      <Badge variant="outline" className="shrink-0 rounded-md font-mono text-[10px]">
        {data.normalizedScore}%
      </Badge>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function IssueRow({
  data,
  onClick,
}: {
  data: ScopeSimulationIssue;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md bg-background px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Badge variant="destructive" className="shrink-0 rounded-md text-[10px]">
        ×{data.frequency}
      </Badge>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-xs font-medium truncate">{data.title}</div>
        <p className="line-clamp-1 text-[11px] text-muted-foreground">{data.description}</p>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="mr-2 size-3.5 animate-spin" />
      正在加载任务表现样本
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed py-2 text-center text-[11px] text-muted-foreground">
      {text}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: import("lucide-react").LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-muted/50">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-xs font-medium">{title}</p>
      <p className="max-w-[240px] text-[11px] leading-4 text-muted-foreground">{description}</p>
    </div>
  );
}
