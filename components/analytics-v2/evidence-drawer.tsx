"use client";

import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type {
  ScopeSimulationHighlight,
  ScopeSimulationIssue,
  ScopeStudyBuddyQuestion,
  TranscriptExcerpt,
} from "@/lib/services/scope-insights.service";

export type EvidenceItem =
  | { type: "highlight"; data: ScopeSimulationHighlight }
  | { type: "issue"; data: ScopeSimulationIssue }
  | { type: "studybuddy_question"; data: ScopeStudyBuddyQuestion; sectionLabel: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidence: EvidenceItem | null;
}

export function EvidenceDrawer({ open, onOpenChange, evidence }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(540px,100vw)] overflow-y-auto sm:max-w-[540px]"
      >
        {evidence ? renderEvidence(evidence) : <EmptyState />}
      </SheetContent>
    </Sheet>
  );
}

function renderEvidence(evidence: EvidenceItem) {
  if (evidence.type === "highlight") return <HighlightEvidence data={evidence.data} />;
  if (evidence.type === "issue") return <IssueEvidence data={evidence.data} />;
  return <StudyBuddyEvidence data={evidence.data} sectionLabel={evidence.sectionLabel} />;
}

function EmptyState() {
  return (
    <SheetHeader>
      <SheetTitle>暂无证据</SheetTitle>
      <SheetDescription>请先选择列表中的一项查看详情。</SheetDescription>
    </SheetHeader>
  );
}

function HighlightEvidence({ data }: { data: ScopeSimulationHighlight }) {
  return (
    <div className="space-y-4 px-1">
      <SheetHeader className="space-y-2 px-0">
        <div className="flex items-center gap-2">
          <Badge className="rounded-md" variant="default">
            高分典型
          </Badge>
          <Badge variant="outline" className="rounded-md font-mono">
            {data.normalizedScore}%
          </Badge>
          <Badge variant="outline" className="rounded-md">
            {data.score}/{data.maxScore}
          </Badge>
        </div>
        <SheetTitle className="text-base">{data.studentName} · {data.taskTitle}</SheetTitle>
        <SheetDescription>{data.reason}</SheetDescription>
      </SheetHeader>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageCircle className="size-4 text-muted-foreground" />
          学生对话节选（{data.transcript.length} 条）
        </div>
        {data.transcript.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            该学生没有可展示的对话节选
          </div>
        ) : (
          <div className="space-y-2">
            {data.transcript.map((turn, idx) => (
              <TranscriptBubble key={idx} turn={turn} />
            ))}
          </div>
        )}
      </div>

      <Separator />

      <Link
        href={`/teacher/instances/${data.taskInstanceId}/insights`}
        className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
      >
        <ExternalLink className="size-4" />
        查看完整提交
      </Link>
    </div>
  );
}

function IssueEvidence({ data }: { data: ScopeSimulationIssue }) {
  return (
    <div className="space-y-4 px-1">
      <SheetHeader className="space-y-2 px-0">
        <div className="flex items-center gap-2">
          <Badge className="rounded-md" variant="destructive">
            低分问题 ×{data.frequency}
          </Badge>
          <Badge variant="outline" className="rounded-md">
            {data.relatedCriterion}
          </Badge>
        </div>
        <SheetTitle className="text-base">{data.title}</SheetTitle>
        <SheetDescription>{data.description}</SheetDescription>
      </SheetHeader>

      <Separator />

      <div className="space-y-3">
        <div className="text-sm font-medium">学生证据（{data.evidence.length} 条）</div>
        {data.evidence.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            暂无具体证据
          </div>
        ) : (
          <div className="space-y-3">
            {data.evidence.map((ev) => (
              <div key={ev.submissionId} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{ev.studentName}</div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="rounded-md font-mono text-xs">
                      {ev.score}%
                    </Badge>
                    <Badge variant="outline" className="rounded-md text-xs">
                      {ev.rubricCriterion}
                    </Badge>
                  </div>
                </div>
                {ev.transcriptExcerpt && (
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                    {ev.transcriptExcerpt}
                  </p>
                )}
                <Link
                  href={`/teacher/instances/${ev.taskInstanceId}/insights`}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  <ExternalLink className="size-3" />
                  查看完整提交
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudyBuddyEvidence({
  data,
  sectionLabel,
}: {
  data: ScopeStudyBuddyQuestion;
  sectionLabel: string;
}) {
  return (
    <div className="space-y-4 px-1">
      <SheetHeader className="space-y-2 px-0">
        <div className="flex items-center gap-2">
          <Badge className="rounded-md" variant="secondary">
            Study Buddy ×{data.count}
          </Badge>
          <Badge variant="outline" className="rounded-md">
            {sectionLabel}
          </Badge>
        </div>
        <SheetTitle className="text-base">{data.text}</SheetTitle>
      </SheetHeader>

      <Separator />

      <div className="space-y-3">
        <div className="text-sm font-medium">提问学生（{data.studentSampleNames.length} 人样本）</div>
        {data.studentSampleNames.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            暂无可展示的学生样本
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.studentSampleNames.map((name, idx) => (
              <Badge key={`${name}-${idx}`} variant="outline" className="rounded-md">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TranscriptBubble({ turn }: { turn: TranscriptExcerpt }) {
  const isStudent = turn.role === "student";
  return (
    <div className={isStudent ? "flex justify-end pl-6" : "flex justify-start pr-6"}>
      <div
        className={
          isStudent
            ? "rounded-lg rounded-tr-sm bg-brand-soft px-3 py-2 text-sm text-brand-fg"
            : "rounded-lg rounded-tl-sm bg-muted px-3 py-2 text-sm"
        }
      >
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>{isStudent ? "学生" : "客户"}</span>
          {turn.mood && <span>· {turn.mood}</span>}
        </div>
        <div className="whitespace-pre-wrap leading-relaxed">{turn.content}</div>
      </div>
    </div>
  );
}
