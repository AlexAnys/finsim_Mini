"use client";

import { cn } from "@/lib/utils";

export interface SummaryStripItem {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  tone?: "default" | "warn" | "success";
}

interface CourseSummaryStripProps {
  items: SummaryStripItem[];
}

const SUB_TONE: Record<NonNullable<SummaryStripItem["tone"]>, string> = {
  default: "text-ink-4",
  warn: "text-warn",
  success: "text-success",
};

export function CourseSummaryStrip({ items }: CourseSummaryStripProps) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-4">
      {items.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "px-5 py-[18px]",
            i > 0 && "md:border-l md:border-line",
            i % 2 === 1 && "border-l border-line md:border-l",
            i >= 2 && "border-t border-line md:border-t-0",
          )}
        >
          <div className="text-[11.5px] tracking-wide text-ink-4">
            {k.label}
          </div>
          <div className="mt-1.5 flex items-baseline gap-0.5">
            <span className="fs-num text-[26px] font-semibold tracking-[-0.02em] text-ink">
              {k.value}
            </span>
            {k.suffix && (
              <span className="text-[13px] text-ink-4">{k.suffix}</span>
            )}
          </div>
          {k.sub && (
            <div
              className={cn(
                "mt-1 text-[11.5px]",
                SUB_TONE[k.tone ?? "default"],
              )}
            >
              {k.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
