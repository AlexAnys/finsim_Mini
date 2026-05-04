"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Lightbulb,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AdviceFocusGroup,
  AdviceKnowledgeGoal,
  AdviceNextStep,
  AdvicePedagogyAdvice,
  ScopeTeachingAdvice,
} from "@/lib/services/scope-insights.service";

interface Props {
  data: ScopeTeachingAdvice | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  studentNamesById?: Map<string, string>;
}

export function TeachingAdviceBlock({
  data,
  loading,
  refreshing,
  onRefresh,
  studentNamesById,
}: Props) {
  const isEmpty =
    !loading &&
    !refreshing &&
    (!data ||
      (data.knowledgeGoals.length === 0 &&
        data.pedagogyAdvice.length === 0 &&
        data.focusGroups.length === 0 &&
        data.nextSteps.length === 0));

  const generatedLabel = data?.generatedAt ? formatDateTime(data.generatedAt) : null;
  const sourceLabel = data?.source === "cache" ? "缓存" : data?.source === "fallback" ? "降级" : "已生成";

  return (
    <Card className="rounded-lg flex flex-col gap-1 overflow-hidden py-3">
      <CardHeader className="pb-1 shrink-0 px-3 grid-cols-[1fr_auto] items-start gap-2 grid space-y-0">
        <div className="min-w-0 flex items-center gap-1.5">
          <Lightbulb className="size-3.5 text-brand shrink-0" />
          <CardTitle className="text-sm font-medium truncate">
            AI 教学建议
            {generatedLabel && (
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {sourceLabel} · {generatedLabel}
              </span>
            )}
          </CardTitle>
        </div>
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
        {data?.notice && (
          <div className="col-span-2 mt-1 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50/50 px-2 py-1 text-[10px] text-amber-800">
            <AlertCircle className="mt-0.5 size-3 shrink-0" />
            <span>{data.notice}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-1 pt-0">
        {loading ? (
          <LoadingState />
        ) : isEmpty ? (
          <EmptyPanel icon={Lightbulb} title="AI 教学建议 · 暂无数据" description="当前范围内没有足够数据生成教学建议；请等学生提交批改后再试。" />
        ) : data ? (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <ColumnCard
              icon={Lightbulb}
              iconClass="text-brand"
              title="知识目标"
              count={data.knowledgeGoals.length}
            >
              <ColumnList
                items={data.knowledgeGoals}
                renderPrimary={(item: AdviceKnowledgeGoal) => item.point}
                renderEvidence={(item) => item.evidence}
              />
            </ColumnCard>
            <ColumnCard
              icon={BookOpen}
              iconClass="text-success"
              title="教学方式"
              count={data.pedagogyAdvice.length}
            >
              <ColumnList
                items={data.pedagogyAdvice}
                renderPrimary={(item: AdvicePedagogyAdvice) => item.method}
                renderEvidence={(item) => item.evidence}
              />
            </ColumnCard>
            <ColumnCard
              icon={Users}
              iconClass="text-brand-violet"
              title="关注群体"
              count={data.focusGroups.length}
            >
              <ColumnList
                items={data.focusGroups}
                renderPrimary={(item: AdviceFocusGroup) => item.group}
                renderSub={(item) => item.action}
                renderEvidence={(item) => item.evidence}
                renderFooter={(item) => {
                  const studentNames = item.studentIds
                    .map((id) => studentNamesById?.get(id) ?? null)
                    .filter((name): name is string => Boolean(name));
                  if (studentNames.length === 0) return null;
                  return (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {studentNames.slice(0, 6).map((name, idx) => (
                        <Badge
                          key={`${name}-${idx}`}
                          variant="outline"
                          className="rounded-md text-[10px]"
                        >
                          {name}
                        </Badge>
                      ))}
                      {studentNames.length > 6 && (
                        <span className="text-[10px] text-muted-foreground">
                          ...等 {studentNames.length - 6} 人
                        </span>
                      )}
                    </div>
                  );
                }}
              />
            </ColumnCard>
            <ColumnCard
              icon={ArrowRight}
              iconClass="text-ochre"
              title="接下来怎么教"
              count={data.nextSteps.length}
            >
              <ColumnList
                items={data.nextSteps}
                renderPrimary={(item: AdviceNextStep) => item.step}
                renderEvidence={(item) => item.evidence}
              />
            </ColumnCard>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ColumnCard({
  icon: Icon,
  iconClass,
  title,
  count,
  children,
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-md border bg-background overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className={cn("size-3.5", iconClass)} />
          <span>{title}</span>
        </div>
        <Badge variant="outline" className="rounded-md text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="max-h-[140px] flex-1 overflow-y-auto px-2 py-1.5">
        {count === 0 ? (
          <div className="rounded-md border border-dashed py-3 text-center text-[11px] text-muted-foreground">
            暂无相关建议
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function ColumnList<T>({
  items,
  renderPrimary,
  renderSub,
  renderEvidence,
  renderFooter,
}: {
  items: T[];
  renderPrimary: (item: T) => string;
  renderSub?: (item: T) => string;
  renderEvidence: (item: T) => string;
  renderFooter?: (item: T) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }
  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        const isExpanded = expanded.has(idx);
        return (
          <div
            key={idx}
            className="rounded-md border bg-background px-2 py-1.5"
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-[11px] leading-4 font-medium">{renderPrimary(item)}</p>
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={cn("size-3 transition-transform", isExpanded && "rotate-180")}
                />
                {isExpanded ? "收" : "据"}
              </button>
            </div>
            {renderSub && (
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                {renderSub(item)}
              </p>
            )}
            {isExpanded && (
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                {renderEvidence(item)}
              </p>
            )}
            {renderFooter && renderFooter(item)}
          </div>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="mr-2 size-3.5 animate-spin" />
      正在生成 AI 教学建议
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
