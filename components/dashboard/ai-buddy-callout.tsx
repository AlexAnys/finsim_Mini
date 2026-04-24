"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

interface AiBuddyCalloutProps {
  href?: string;
  eyebrow?: string;
  title?: string;
  hint?: string;
  ctaLabel?: string;
}

export function AiBuddyCallout({
  href = "/study-buddy",
  eyebrow = "学习伙伴",
  title = "随时向 AI 学习伙伴提问",
  hint = "课业疑问、术语解释、案例复习——立即开始对话",
  ctaLabel = "开始对话",
}: AiBuddyCalloutProps) {
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
