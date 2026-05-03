"use client";

import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type {
  LowScorer,
  MissingStudent,
  PendingSubmission,
  RiskChapterDetail,
  RiskStudentDetail,
  ScoreBinStudent,
} from "@/lib/services/scope-drilldown.service";

export type RiskDrawerKind =
  | "score_bin"
  | "completion_rate"
  | "avg_score"
  | "pending_release"
  | "risk_chapter"
  | "risk_student";

export interface RiskDrawerState {
  kind: RiskDrawerKind;
  loading: boolean;
  items: unknown[];
  error: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RiskDrawerState | null;
}

const REASON_LABELS: Record<RiskStudentDetail["reason"], string> = {
  not_submitted: "未提交",
  low_score: "低掌握",
  declining: "退步",
};

export function RiskDrawer({ open, onOpenChange, state }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(560px,100vw)] overflow-y-auto sm:max-w-[560px]"
      >
        {state ? <RenderState state={state} /> : <EmptyState />}
      </SheetContent>
    </Sheet>
  );
}

function EmptyState() {
  return (
    <SheetHeader>
      <SheetTitle>暂无内容</SheetTitle>
      <SheetDescription>请先点击 KPI 卡片查看下钻数据。</SheetDescription>
    </SheetHeader>
  );
}

function RenderState({ state }: { state: RiskDrawerState }) {
  const title = headerTitle(state.kind, state.items.length, state.loading);
  const description = headerDescription(state.kind);
  return (
    <div className="space-y-4 px-1">
      <SheetHeader className="space-y-1 px-0">
        <SheetTitle className="text-base">{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
      </SheetHeader>
      {state.loading ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : state.items.length === 0 ? (
        <EmptyHint kind={state.kind} />
      ) : (
        <RenderList kind={state.kind} items={state.items} />
      )}
    </div>
  );
}

function RenderList({ kind, items }: { kind: RiskDrawerKind; items: unknown[] }) {
  if (kind === "score_bin") {
    return (
      <div className="space-y-2">
        {(items as ScoreBinStudent[]).map((item, idx) => (
          <Row
            key={`${item.studentId}-${item.taskInstanceId ?? "none"}-${idx}`}
            primary={`${item.studentName} · ${item.className}`}
            secondary={`分数区间 ${item.binLabel}`}
            badge={<Badge variant="outline" className="rounded-md font-mono">{item.score}%</Badge>}
            links={[insightsLink(item.taskInstanceId)]}
          />
        ))}
      </div>
    );
  }
  if (kind === "completion_rate") {
    return (
      <div className="space-y-2">
        {(items as MissingStudent[]).map((item, idx) => (
          <Row
            key={`${item.studentId}-${item.taskInstanceId}-${idx}`}
            primary={`${item.studentName} · ${item.className}`}
            secondary={`未提交：${item.taskTitle}`}
            links={[insightsLink(item.taskInstanceId)]}
          />
        ))}
      </div>
    );
  }
  if (kind === "avg_score") {
    return (
      <div className="space-y-2">
        {(items as LowScorer[]).map((item, idx) => (
          <Row
            key={`${item.studentId}-${item.taskInstanceId}-${idx}`}
            primary={`${item.studentName} · ${item.className}`}
            secondary={item.taskTitle}
            badge={<Badge variant="destructive" className="rounded-md font-mono">{item.normalizedScore}%</Badge>}
            links={[insightsLink(item.taskInstanceId)]}
          />
        ))}
      </div>
    );
  }
  if (kind === "pending_release") {
    return (
      <div className="space-y-2">
        {(items as PendingSubmission[]).map((item, idx) => (
          <Row
            key={`${item.submissionId}-${idx}`}
            primary={`${item.studentName} · ${item.className}`}
            secondary={`${item.taskTitle} · DDL ${formatDate(item.dueAt)} · 状态 ${item.status}`}
            links={[
              insightsLink(item.taskInstanceId),
              gradeLink(item.taskInstanceId),
            ]}
          />
        ))}
      </div>
    );
  }
  if (kind === "risk_chapter") {
    return (
      <div className="space-y-2">
        {(items as RiskChapterDetail[]).map((item, idx) => (
          <div key={`${item.chapterId ?? "null"}-${idx}`} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{item.title}</p>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="rounded-md text-[10px]">
                  完成率 {formatRate(item.completionRate)}
                </Badge>
                <Badge variant="destructive" className="rounded-md text-[10px]">
                  均分 {formatPercent(item.avgNormalizedScore)}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">{item.instanceCount} 个任务</p>
              {item.instances.slice(0, 8).map((inst) => (
                <Link
                  key={inst.id}
                  href={`/teacher/instances/${inst.id}/insights`}
                  className="flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {inst.title} · {inst.className}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "risk_student") {
    return (
      <div className="space-y-2">
        {(items as RiskStudentDetail[]).map((item, idx) => (
          <div key={`${item.studentId}-${idx}`} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{item.studentName} · {item.className}</p>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="rounded-md text-[10px]">
                  {REASON_LABELS[item.reason]}
                </Badge>
                {item.selectedScore !== null && (
                  <Badge variant="outline" className="rounded-md font-mono text-[10px]">
                    {item.selectedScore}%
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {item.taskInstances.slice(0, 6).map((inst) => (
                <Link
                  key={inst.id}
                  href={`/teacher/instances/${inst.id}/insights`}
                  className="flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {inst.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function Row({
  primary,
  secondary,
  badge,
  links,
}: {
  primary: string;
  secondary: string;
  badge?: React.ReactNode;
  links: React.ReactNode[];
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{primary}</p>
          <p className="text-xs text-muted-foreground">{secondary}</p>
        </div>
        {badge}
      </div>
      <div className="flex flex-wrap gap-3">
        {links.filter(Boolean).map((link, idx) => (
          <span key={idx}>{link}</span>
        ))}
      </div>
    </div>
  );
}

function insightsLink(taskInstanceId: string | null) {
  if (!taskInstanceId) return null;
  return (
    <Link
      href={`/teacher/instances/${taskInstanceId}/insights`}
      className="flex items-center gap-1 text-xs text-brand hover:underline"
    >
      <ExternalLink className="size-3" />
      单实例洞察
    </Link>
  );
}

function gradeLink(taskInstanceId: string | null) {
  if (!taskInstanceId) return null;
  return (
    <Link
      href={`/teacher/instances/${taskInstanceId}`}
      className="flex items-center gap-1 text-xs text-brand hover:underline"
    >
      <ExternalLink className="size-3" />
      去批改
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      正在加载下钻数据
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function EmptyHint({ kind }: { kind: RiskDrawerKind }) {
  const labels: Record<RiskDrawerKind, string> = {
    score_bin: "该分数区间学生",
    completion_rate: "未提交学生",
    avg_score: "低分学生",
    pending_release: "待发布作业",
    risk_chapter: "风险章节",
    risk_student: "风险学生",
  };
  return (
    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
      当前范围内无{labels[kind]}
    </div>
  );
}

function headerTitle(kind: RiskDrawerKind, count: number, loading: boolean): string {
  const labels: Record<RiskDrawerKind, [string, string]> = {
    score_bin: ["分数区间学生", "人"],
    completion_rate: ["未提交学生", "人"],
    avg_score: ["低分学生", "人"],
    pending_release: ["待发布作业", "件"],
    risk_chapter: ["风险章节", "个"],
    risk_student: ["风险学生", "名"],
  };
  const [label, unit] = labels[kind];
  if (loading) return `${label} · 加载中`;
  return `${label} · ${count} ${unit}`;
}

function headerDescription(kind: RiskDrawerKind): string {
  const map: Record<RiskDrawerKind, string> = {
    score_bin: "该分数区间内的学生 · 限 50 行",
    completion_rate: "尚未提交当前范围任务的学生 · 限 50 行",
    avg_score: "归一化得分低于 60% 的提交 · 限 50 行",
    pending_release: "DDL 已到但分数尚未发布给学生 · 限 50 行",
    risk_chapter: "完成率低于 60% 或均分低于 60 的章节",
    risk_student: "未提交 / 低掌握 / 退步学生（按学生去重，按 reason 严重度排序）",
  };
  return map[kind];
}

function formatDate(value: string | null) {
  if (!value) return "无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRate(value: number | null) {
  if (value === null) return "无";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatPercent(value: number | null) {
  if (value === null) return "无";
  return `${Math.round(value * 10) / 10}%`;
}
