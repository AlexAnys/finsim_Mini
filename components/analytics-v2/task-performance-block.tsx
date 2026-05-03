"use client";

import { ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComingSoon } from "@/components/analytics-v2/coming-soon";
import type {
  ScopeSimulationHighlight,
  ScopeSimulationInsight,
  ScopeSimulationIssue,
} from "@/lib/services/scope-insights.service";
import type { EvidenceItem } from "@/components/analytics-v2/evidence-drawer";

interface Props {
  data: ScopeSimulationInsight | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpenEvidence?: (evidence: EvidenceItem) => void;
}

export function TaskPerformanceBlock({
  data,
  loading,
  refreshing,
  onRefresh,
  onOpenEvidence,
}: Props) {
  const highlights = data?.highlights ?? [];
  const issues = data?.commonIssues ?? [];
  const isEmpty = !loading && !refreshing && highlights.length === 0 && issues.length === 0;
  const generatedLabel = data?.generatedAt ? formatDateTime(data.generatedAt) : null;
  const sourceLabel = data?.source === "cache" ? "缓存" : data?.source === "fallback" ? "降级" : "已生成";

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-brand" />
              任务表现典型例子
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {generatedLabel ? `${sourceLabel} · ${generatedLabel}` : "尚未生成"}
              {data?.notice ? ` · ${data.notice}` : ""}
            </p>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              重新生成
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState />
        ) : isEmpty ? (
          <ComingSoon
            icon={Sparkles}
            title="任务表现 · 暂无数据"
            description="当前范围无 simulation graded 数据；请扩大筛选范围或先批改若干 simulation 提交。"
          />
        ) : (
          <Tabs defaultValue="highlights" className="space-y-3">
            <TabsList className="h-8 w-full">
              <TabsTrigger value="highlights" className="flex-1 text-xs">
                高分典型 ({highlights.length})
              </TabsTrigger>
              <TabsTrigger value="issues" className="flex-1 text-xs">
                低分问题 ({issues.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="highlights">
              {highlights.length === 0 ? (
                <EmptyHint text="当前范围暂无高分典型样本" />
              ) : (
                <div className="space-y-2">
                  {highlights.map((h) => (
                    <HighlightRow
                      key={h.submissionId}
                      data={h}
                      onClick={() =>
                        onOpenEvidence?.({ type: "highlight", data: h })
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="issues">
              {issues.length === 0 ? (
                <EmptyHint text="当前范围暂无低分共性问题" />
              ) : (
                <div className="space-y-2">
                  {issues.map((issue, idx) => (
                    <IssueRow
                      key={`${issue.title}-${idx}`}
                      data={issue}
                      onClick={() =>
                        onOpenEvidence?.({ type: "issue", data: issue })
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
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
      className="flex w-full items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{data.studentName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="truncate text-muted-foreground">{data.taskTitle}</span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{data.reason}</p>
      </div>
      <Badge variant="outline" className="shrink-0 rounded-md font-mono">
        {data.normalizedScore}%
      </Badge>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
      className="flex w-full items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Badge variant="destructive" className="shrink-0 rounded-md">
        ×{data.frequency}
      </Badge>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{data.title}</span>
          <Badge variant="outline" className="rounded-md text-[10px]">
            {data.relatedCriterion}
          </Badge>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{data.description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      正在加载任务表现样本
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
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
