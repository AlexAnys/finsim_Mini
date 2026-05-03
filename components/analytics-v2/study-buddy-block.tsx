"use client";

import { Loader2, MessageCircleQuestionMark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComingSoon } from "@/components/analytics-v2/coming-soon";
import type { ScopeStudyBuddySummary } from "@/lib/services/scope-insights.service";
import type { EvidenceItem } from "@/components/analytics-v2/evidence-drawer";

interface Props {
  data: ScopeStudyBuddySummary | null;
  loading?: boolean;
  onOpenEvidence?: (evidence: EvidenceItem) => void;
}

export function StudyBuddyBlock({ data, loading, onOpenEvidence }: Props) {
  const sections = data?.bySection ?? [];
  const generatedLabel = data?.generatedAt ? formatDateTime(data.generatedAt) : null;
  const isEmpty = !loading && sections.length === 0;
  const totalQuestions = sections.reduce((acc, s) => acc + s.topQuestions.length, 0);

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircleQuestionMark className="size-4 text-brand" />
            Study Buddy 共性问题
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {generatedLabel ? `更新 ${generatedLabel}` : "尚未生成"}
            {totalQuestions > 0 ? ` · 共 ${sections.length} 节 / ${totalQuestions} 个问题` : ""}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState />
        ) : isEmpty ? (
          <ComingSoon
            icon={MessageCircleQuestionMark}
            title="Study Buddy · 暂无数据"
            description="当前范围内学生未在 Study Buddy 提出可聚合的问题；请等数据累积或扩大筛选范围。"
          />
        ) : (
          <Accordion
            type="multiple"
            defaultValue={sections.slice(0, 1).map((s) => s.sectionId ?? "__null__")}
            className="space-y-1"
          >
            {sections.map((section) => {
              const value = section.sectionId ?? "__null__";
              return (
                <AccordionItem key={value} value={value} className="rounded-md border bg-background px-3">
                  <AccordionTrigger className="py-2.5">
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm font-medium">{section.sectionLabel}</span>
                      <Badge variant="outline" className="rounded-md text-[10px]">
                        {section.topQuestions.length} 题
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1.5">
                      {section.topQuestions.map((q, idx) => (
                        <button
                          key={`${q.text}-${idx}`}
                          type="button"
                          onClick={() =>
                            onOpenEvidence?.({
                              type: "studybuddy_question",
                              data: q,
                              sectionLabel: section.sectionLabel,
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Badge variant="secondary" className="shrink-0 rounded-md font-mono text-[10px]">
                            ×{q.count}
                          </Badge>
                          <span className="line-clamp-2 flex-1 text-xs leading-5">{q.text}</span>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      正在加载 Study Buddy 共性问题
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
