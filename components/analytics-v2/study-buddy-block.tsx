"use client";

import { Loader2, MessageCircleQuestionMark } from "lucide-react";
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
}

const MAX_ROWS = 5;

export function StudyBuddyBlock({ data, loading, onOpenEvidence }: Props) {
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
    <Card className="rounded-lg flex h-full flex-col overflow-hidden">
      <CardHeader className="space-y-1 pb-2 shrink-0">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <MessageCircleQuestionMark className="size-3.5 text-brand" />
          Study Buddy 共性问题
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          {generatedLabel ? `更新 ${generatedLabel}` : "尚未生成"}
          {totalQuestions > 0 ? ` · ${sections.length} 节 / ${totalQuestions} 个问题` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0 pb-3 px-4">
        {loading ? (
          <LoadingState />
        ) : isEmpty || rows.length === 0 ? (
          <EmptyPanel icon={MessageCircleQuestionMark} title="Study Buddy · 暂无数据" description="当前范围内学生未在 Study Buddy 提出可聚合的问题；请等数据累积或扩大筛选范围。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 px-2 text-[11px]">章节/节</TableHead>
                <TableHead className="h-7 px-2 text-[11px]">典型问题</TableHead>
                <TableHead className="h-7 px-2 text-right text-[11px]">提问</TableHead>
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
                  <TableCell className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    {row.sectionLabel}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-xs">
                    <span className="line-clamp-2">{row.question.text}</span>
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-right font-mono text-[11px]">
                    ×{row.question.count}
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
    <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
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
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-muted/50">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-xs font-medium">{title}</p>
      <p className="max-w-[240px] text-[11px] leading-4 text-muted-foreground">{description}</p>
    </div>
  );
}
