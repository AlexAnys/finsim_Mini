"use client";

import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ContentBlockRow,
  type ContentBlockRowKind,
} from "@/components/course-detail/content-block-row";
import {
  SectionTaskRow,
  type SectionTaskRowData,
} from "@/components/course-detail/section-task-row";
import { cn } from "@/lib/utils";

export type SectionTimelineSlot = "pre" | "in" | "post";
export type SectionState = "done" | "active" | "locked" | "upcoming";

export interface SectionContentBlock {
  id: string;
  kind: ContentBlockRowKind;
  slot: SectionTimelineSlot;
  title: string;
  meta?: string | null;
  href?: string;
}

export interface SectionTimelineTask extends SectionTaskRowData {
  slot: SectionTimelineSlot;
}

export interface SectionTimelineData {
  id: string;
  number: string; // e.g. "5.1"
  title: string;
  state: SectionState;
  blocks: SectionContentBlock[];
  tasks: SectionTimelineTask[];
  /** Status subtitle: e.g. "已完成 · 得分 9/10" or "本节进行中 · 2 项未完成" or "下周解锁" */
  statusLine: string;
}

interface SectionTimelineProps {
  data: SectionTimelineData;
}

const SLOT_LABELS: Record<SectionTimelineSlot, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

const SLOT_ORDER: SectionTimelineSlot[] = ["pre", "in", "post"];

export function SectionTimeline({ data }: SectionTimelineProps) {
  const hasItems = data.blocks.length + data.tasks.length > 0;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border",
        data.state === "active"
          ? "border-brand-soft-2 bg-paper-alt"
          : "border-line bg-surface",
        data.state === "locked" && "opacity-60",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 px-4 py-3.5",
          hasItems && "border-b border-line",
        )}
      >
        <div
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg font-mono text-[11.5px] font-semibold fs-num",
            data.state === "done" && "bg-success-soft text-success-deep",
            data.state === "active" && "bg-brand-soft text-brand",
            (data.state === "upcoming" || data.state === "locked") &&
              "bg-paper text-ink-4",
          )}
        >
          {data.state === "done" ? (
            <Check className="size-[13px]" strokeWidth={2.5} />
          ) : (
            data.number
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink">
            {data.title}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-4">
            {data.statusLine}
          </div>
        </div>
        {data.state === "active" && (
          <Badge variant="secondary" className="bg-brand-soft text-brand">
            进行中
          </Badge>
        )}
        {data.state === "done" && (
          <Badge
            variant="secondary"
            className="bg-success-soft text-success-deep"
          >
            已完成
          </Badge>
        )}
        {data.state === "locked" && (
          <Badge variant="secondary" className="bg-paper-alt text-ink-4">
            未解锁
          </Badge>
        )}
        <ChevronDown className="size-[14px] text-ink-5" aria-hidden="true" />
      </header>

      {hasItems && (
        <div className="px-4 py-3">
          {SLOT_ORDER.map((slot) => {
            const slotBlocks = data.blocks.filter((b) => b.slot === slot);
            const slotTasks = data.tasks.filter((t) => t.slot === slot);
            if (slotBlocks.length === 0 && slotTasks.length === 0) return null;

            return (
              <div key={slot} className="flex gap-3.5 py-1.5">
                <div className="w-10 shrink-0 pt-2 text-[11px] font-semibold text-ink-4">
                  {SLOT_LABELS[slot]}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {slotBlocks.map((b) => (
                    <ContentBlockRow
                      key={b.id}
                      kind={b.kind}
                      title={b.title}
                      meta={b.meta}
                      href={b.href}
                    />
                  ))}
                  {slotTasks.map((t) => (
                    <SectionTaskRow key={t.id} task={t} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
