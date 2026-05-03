"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

interface AiSuggestCalloutProps {
  insightsHref?: string;
  assistantHref?: string;
  variant?: "callout" | "header-chip";
  /** PR-DASH-1e: header-chip 模式下，点击"一周洞察"按钮触发 modal 而非跳转 */
  onWeeklyInsightClick?: () => void;
  /** PR-DASH-1e: header-chip 模式下，正在加载时显示 spinner */
  weeklyInsightLoading?: boolean;
}

export function AiSuggestCallout({
  insightsHref = "/teacher/analytics-v2",
  assistantHref = "/teacher/ai-assistant",
  variant = "callout",
  onWeeklyInsightClick,
  weeklyInsightLoading = false,
}: AiSuggestCalloutProps) {
  if (variant === "header-chip") {
    return (
      <div
        className="inline-flex items-center gap-2.5 rounded-full bg-paper-alt px-3 py-1.5"
        style={{ border: "1px solid var(--fs-line)" }}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft">
          <Sparkles className="size-[12px] text-ochre" />
        </span>
        <div className="flex min-w-0 items-center gap-2 text-[12px]">
          <span className="font-semibold text-ink-2">AI 助手</span>
          <span className="text-ink-5">·</span>
          <span className="truncate text-ink-3">本周建议</span>
        </div>
        {onWeeklyInsightClick ? (
          <button
            type="button"
            onClick={onWeeklyInsightClick}
            disabled={weeklyInsightLoading}
            aria-label="生成一周洞察"
            className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[12px] font-medium text-[var(--fs-primary-fg)] transition-colors hover:bg-brand-lift disabled:cursor-not-allowed disabled:opacity-70"
          >
            一周洞察
            {weeklyInsightLoading ? (
              <Loader2 className="size-[11px] animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="size-[11px]" aria-hidden />
            )}
          </button>
        ) : (
          <Link
            href={insightsHref}
            className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[12px] font-medium text-[var(--fs-primary-fg)] transition-colors hover:bg-brand-lift"
          >
            一周洞察
            <ArrowRight className="size-[11px]" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-xl bg-ink-2 p-4 text-[var(--fs-primary-fg)]">
      <div className="pointer-events-none absolute -right-3 -top-3 opacity-15">
        <Sparkles className="size-20" strokeWidth={1.2} />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-[14px] text-ochre" />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--fs-accent)" }}
        >
          AI 助手 · 本周建议
        </span>
      </div>
      <h3 className="mb-1.5 text-[13.5px] font-medium leading-[1.5]">
        想快速发现低分知识点、学习差距与教学空缺？
      </h3>
      <p className="mb-3 text-[11.5px] opacity-80">
        打开 AI 助手，基于近 7 天提交生成班级洞察与课堂讲解建议
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={assistantHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-ochre px-3 py-1.5 text-[12px] font-medium text-[var(--fs-primary-fg)] transition-transform hover:scale-[1.02]"
        >
          打开 AI 助手
          <ArrowRight className="size-[11px]" />
        </Link>
        <Link
          href={insightsHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-white/20"
        >
          一周洞察
        </Link>
      </div>
    </section>
  );
}
