"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

interface AiBuddyCalloutProps {
  href?: string;
  eyebrow?: string;
  title?: string;
  hint?: string;
  ctaLabel?: string;
  compact?: boolean;
}

export function AiBuddyCallout({
  href = "/study-buddy",
  eyebrow = "学习伙伴",
  title = "随时向 AI 学习伙伴提问",
  hint = "课业疑问、术语解释、案例复习——立即开始对话",
  ctaLabel = "开始对话",
  compact = false,
}: AiBuddyCalloutProps) {
  if (compact) {
    return (
      <Link
        href={href}
        className="hidden min-w-[360px] max-w-[420px] items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-fs transition-colors hover:bg-surface-tint xl:flex"
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg"
          style={{ background: "var(--fs-sim-soft)", color: "var(--fs-sim)" }}
        >
          <Sparkles className="size-[16px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-ink-2">
            {eyebrow}
          </span>
          <span className="block truncate text-[11.5px] text-ink-4">
            {hint}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-soft px-2.5 py-1.5 text-[12px] font-medium text-brand">
          {ctaLabel}
          <ArrowRight className="size-[11px]" />
        </span>
      </Link>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-xl p-4 text-white"
      style={{
        background: "linear-gradient(135deg, var(--fs-primary), var(--fs-primary-lift))",
      }}
    >
      <div className="pointer-events-none absolute -right-2.5 -top-2.5 opacity-15">
        <Sparkles className="size-20" strokeWidth={1.2} />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-[14px] text-ochre" />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--fs-accent-soft)" }}
        >
          {eyebrow}
        </span>
      </div>
      <h3 className="mb-1.5 text-sm font-semibold leading-[1.4]">{title}</h3>
      <p className="mb-2.5 text-[11.5px] opacity-80">{hint}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-brand transition-transform hover:scale-[1.02]"
      >
        {ctaLabel}
        <ArrowRight className="size-[12px]" />
      </Link>
    </section>
  );
}
