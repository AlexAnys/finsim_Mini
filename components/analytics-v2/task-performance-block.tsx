"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
    <Card className="rounded-lg flex h-full flex-col gap-2 overflow-hidden py-3">
      <CardHeader className="space-y-0 pb-1 shrink-0 px-3 grid-cols-[1fr_auto] items-center gap-2 grid">
        <div className="min-w-0 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-brand shrink-0" />
          <CardTitle className="text-sm font-medium truncate">
            任务表现 (Simulation)
            {generatedLabel && (
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {sourceLabel} · {generatedLabel}
              </span>
            )}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5">
          {taskOptions.length > 0 && onTaskChange && (
            <Select
              value={selectedTaskId || ALL_TASKS}
              onValueChange={(v) => onTaskChange(v === ALL_TASKS ? "" : v)}
            >
              <SelectTrigger size="sm" className="h-7 w-[220px] rounded-md text-xs">
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
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
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
          {detailHref && (
            <Link
              href={detailHref}
              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              详情 <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 pb-1 px-3">
        {loading ? (
          <LoadingState />
        ) : isEmpty ? (
          <EmptyPanel icon={Sparkles} title="任务表现 · 暂无数据" description="当前范围无 simulation graded 数据；请扩大筛选范围或先批改若干 simulation 提交。" />
        ) : (
          <div className="grid h-full grid-cols-2 gap-2.5">
            <SectionColumn
              tone="success"
              icon={CircleCheck}
              label="高分典型表现"
              count={filteredHighlights.length}
            >
              {filteredHighlights.length === 0 ? (
                <EmptyHint text="当前范围暂无高分典型样本" />
              ) : (
                filteredHighlights.slice(0, 6).map((h) => (
                  <HighlightRow
                    key={h.submissionId}
                    data={h}
                    onClick={() => onOpenEvidence?.({ type: "highlight", data: h })}
                  />
                ))
              )}
            </SectionColumn>

            <SectionColumn
              tone="destructive"
              icon={CircleAlert}
              label="低分共性问题"
              count={filteredIssues.length}
            >
              {filteredIssues.length === 0 ? (
                <EmptyHint text="当前范围暂无低分共性问题" />
              ) : (
                filteredIssues.slice(0, 6).map((issue, idx) => (
                  <IssueRow
                    key={`${issue.title}-${idx}`}
                    data={issue}
                    onClick={() => onOpenEvidence?.({ type: "issue", data: issue })}
                  />
                ))
              )}
            </SectionColumn>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionColumn({
  tone,
  icon: Icon,
  label,
  count,
  children,
}: {
  tone: "success" | "destructive";
  icon: import("lucide-react").LucideIcon;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const sectionStyle =
    tone === "success"
      ? "border-l-2 border-success bg-success/5"
      : "border-l-2 border-destructive bg-destructive/5";
  const labelClass =
    tone === "success" ? "text-success" : "text-destructive";
  return (
    <div className={`flex h-full flex-col rounded-r ${sectionStyle} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 shrink-0">
        <h4 className={`flex items-center gap-1 text-xs font-medium ${labelClass}`}>
          <Icon className="size-3" />
          {label}
        </h4>
        <Badge variant="outline" className="rounded-md text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-2.5">
        <div className="space-y-1.5">{children}</div>
      </div>
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
      className="block w-full rounded-md bg-background px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-xs font-medium truncate">{data.studentName}</span>
        <Badge variant="outline" className="shrink-0 rounded-md font-mono text-[10px] h-4 px-1">
          {data.normalizedScore}分
        </Badge>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
        {data.reason}
      </p>
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
      className="block w-full rounded-md bg-background px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-1.5">
        <Badge variant="destructive" className="shrink-0 rounded-md text-[10px] h-4 px-1">
          ×{data.frequency}
        </Badge>
        <span className="text-xs font-medium line-clamp-1">{data.title}</span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
        {data.description}
      </p>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="mr-2 size-3.5 animate-spin" />
      正在加载任务表现样本
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed py-3 text-center text-[11px] text-muted-foreground">
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
