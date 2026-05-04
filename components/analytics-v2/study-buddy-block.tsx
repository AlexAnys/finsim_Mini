"use client";

import { ArrowRight, Loader2, MessageCircleQuestionMark } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScopeStudyBuddySummary } from "@/lib/services/scope-insights.service";
import type { EvidenceItem } from "@/components/analytics-v2/evidence-drawer";

interface Props {
  data: ScopeStudyBuddySummary | null;
  loading?: boolean;
  onOpenEvidence?: (evidence: EvidenceItem) => void;
  onViewAll?: () => void;
}

const MAX_ROWS = 5;

export function StudyBuddyBlock({ data, loading, onOpenEvidence, onViewAll }: Props) {
  const sections = data?.bySection ?? [];
  const generatedLabel = data?.generatedAt ? formatDateTime(data.generatedAt) : null;
  const isEmpty = !loading && sections.length === 0;
  const rows = sections
    .filter((s) => s.topQuestions.length > 0)
    .slice(0, MAX_ROWS)
    .map((s) => ({
      sectionLabel: s.sectionLabel,
      sectionId: s.sectionId,
      question: s.topQuestions[0],
    }));
  const totalQuestions = sections.reduce((acc, s) => acc + s.topQuestions.length, 0);

  return (
    <Card className="rounded-lg flex h-full flex-col gap-2 overflow-hidden py-3">
      <CardHeader className="space-y-0 pb-1 shrink-0 px-3 grid-cols-[1fr_auto] items-center gap-2 grid">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium min-w-0">
          <MessageCircleQuestionMark className="size-3.5 text-brand shrink-0" />
          <span className="truncate">
            Study Buddy 共性问题
            {totalQuestions > 0 && (
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                {generatedLabel ? `${generatedLabel} · ` : ""}{sections.length} 节 / {totalQuestions} 题
              </span>
            )}
          </span>
        </CardTitle>
        {onViewAll && rows.length > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            全部 <ArrowRight className="size-3" />
          </button>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0 pb-1 px-3">
        {loading ? (
          <LoadingState />
        ) : isEmpty || rows.length === 0 ? (
          <EmptyPanel icon={MessageCircleQuestionMark} title="Study Buddy · 暂无数据" description="当前范围内学生未在 Study Buddy 提出可聚合的问题；请等数据累积或扩大筛选范围。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-6 px-1.5 text-[10px] w-[32%]">章节/节</TableHead>
                <TableHead className="h-6 px-1.5 text-[10px]">典型问题</TableHead>
                <TableHead className="h-6 px-1.5 text-right text-[10px] w-10">次数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow
                  key={`${row.sectionId ?? "null"}-${idx}`}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() =>
                    onOpenEvidence?.({
                      type: "studybuddy_question",
                      data: row.question,
                      sectionLabel: row.sectionLabel,
                    })
                  }
                >
                  <TableCell className="px-1.5 py-1.5 text-[11px] text-muted-foreground truncate">
                    {row.sectionLabel}
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5 text-xs">
                    <span className="line-clamp-2">{row.question.text}</span>
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5 text-right font-mono text-[11px] tabular-nums">
                    {row.question.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-[80px] items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="mr-2 size-3.5 animate-spin" />
      正在加载共性问题
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
    <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1.5 px-3 text-center">
      <div className="flex size-7 items-center justify-center rounded-full bg-muted/50">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className="text-xs font-medium">{title}</p>
      <p className="max-w-[220px] text-[10px] leading-4 text-muted-foreground">{description}</p>
    </div>
  );
}
