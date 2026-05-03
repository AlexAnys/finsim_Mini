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
import { ComingSoon } from "@/components/analytics-v2/coming-soon";
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
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-brand" />
              AI 教学建议
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {generatedLabel ? `${sourceLabel} · ${generatedLabel}` : "尚未生成"}
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
        {data?.notice && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{data.notice}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <LoadingState />
        ) : isEmpty ? (
          <ComingSoon
            icon={Lightbulb}
            title="AI 教学建议 · 暂无数据"
            description="当前范围内没有足够数据生成教学建议；请等学生提交批改后再试。"
          />
        ) : data ? (
          <>
            <KnowledgeGoalsSection items={data.knowledgeGoals} />
            <PedagogySection items={data.pedagogyAdvice} />
            <FocusGroupsSection items={data.focusGroups} studentNamesById={studentNamesById} />
            <NextStepsSection items={data.nextSteps} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KnowledgeGoalsSection({ items }: { items: AdviceKnowledgeGoal[] }) {
  return (
    <SectionShell icon={Lightbulb} title="知识目标" count={items.length}>
      <ItemList
        items={items}
        renderItem={(item, idx, expanded, toggle) => (
          <AdviceItemRow key={idx} primary={item.point} evidence={item.evidence} expanded={expanded} toggle={toggle} />
        )}
      />
    </SectionShell>
  );
}

function PedagogySection({ items }: { items: AdvicePedagogyAdvice[] }) {
  return (
    <SectionShell icon={BookOpen} title="教学方式" count={items.length}>
      <ItemList
        items={items}
        renderItem={(item, idx, expanded, toggle) => (
          <AdviceItemRow key={idx} primary={item.method} evidence={item.evidence} expanded={expanded} toggle={toggle} />
        )}
      />
    </SectionShell>
  );
}

function FocusGroupsSection({
  items,
  studentNamesById,
}: {
  items: AdviceFocusGroup[];
  studentNamesById?: Map<string, string>;
}) {
  return (
    <SectionShell icon={Users} title="关注群体" count={items.length}>
      <ItemList
        items={items}
        renderItem={(item, idx, expanded, toggle) => (
          <FocusGroupRow
            key={idx}
            item={item}
            expanded={expanded}
            toggle={toggle}
            studentNamesById={studentNamesById}
          />
        )}
      />
    </SectionShell>
  );
}

function NextStepsSection({ items }: { items: AdviceNextStep[] }) {
  return (
    <SectionShell icon={ArrowRight} title="接下来怎么教" count={items.length}>
      <ItemList
        items={items}
        renderItem={(item, idx, expanded, toggle) => (
          <AdviceItemRow key={idx} primary={item.step} evidence={item.evidence} expanded={expanded} toggle={toggle} />
        )}
      />
    </SectionShell>
  );
}

function SectionShell({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-3.5 text-muted-foreground" />
        <span>{title}</span>
        <Badge variant="outline" className="rounded-md text-[10px]">
          {count}
        </Badge>
      </div>
      {count === 0 ? (
        <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
          暂无相关建议
        </div>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  );
}

const VISIBLE_THRESHOLD = 4;

function ItemList<T>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (
    item: T,
    idx: number,
    expanded: boolean,
    toggle: () => void,
  ) => React.ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const visible = showAll ? items : items.slice(0, VISIBLE_THRESHOLD);
  function toggleRow(idx: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }
  return (
    <>
      {visible.map((item, idx) => renderItem(item, idx, expandedRows.has(idx), () => toggleRow(idx)))}
      {items.length > VISIBLE_THRESHOLD && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? "收起" : `展开剩余 ${items.length - VISIBLE_THRESHOLD} 条`}
        </Button>
      )}
    </>
  );
}

function AdviceItemRow({
  primary,
  evidence,
  expanded,
  toggle,
}: {
  primary: string;
  evidence: string;
  expanded: boolean;
  toggle: () => void;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-5">{primary}</p>
        <button
          type="button"
          onClick={toggle}
          className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
          {expanded ? "收起依据" : "依据"}
        </button>
      </div>
      {expanded && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{evidence}</p>}
    </div>
  );
}

function FocusGroupRow({
  item,
  expanded,
  toggle,
  studentNamesById,
}: {
  item: AdviceFocusGroup;
  expanded: boolean;
  toggle: () => void;
  studentNamesById?: Map<string, string>;
}) {
  const studentNames = item.studentIds
    .map((id) => studentNamesById?.get(id) ?? null)
    .filter((name): name is string => Boolean(name));
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-5">
            {item.group}
            {item.studentIds.length > 0 && (
              <Badge variant="outline" className="ml-2 rounded-md text-[10px]">
                {item.studentIds.length} 名学生
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{item.action}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
          {expanded ? "收起" : "依据"}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-xs leading-5 text-muted-foreground">{item.evidence}</p>
          {studentNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {studentNames.slice(0, 12).map((name, idx) => (
                <Badge key={`${name}-${idx}`} variant="outline" className="rounded-md text-[10px]">
                  {name}
                </Badge>
              ))}
              {studentNames.length > 12 && (
                <span className="text-[10px] text-muted-foreground">...等 {studentNames.length - 12} 人</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
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
