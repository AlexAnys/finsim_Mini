"use client";

import Link from "next/link";
import { CalendarDays, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GreetingHeroProps {
  name: string;
  dateLine: string;
  summaryParts: Array<{
    label: string;
    value: string | number;
    tone: "brand" | "warn" | "ink";
  }>;
  suffix?: string;
  continueHref?: string;
}

function greetingWord(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const TONE_CLASS: Record<"brand" | "warn" | "ink", string> = {
  brand: "text-brand font-semibold",
  warn: "text-warn font-semibold",
  ink: "text-ink-2 font-semibold",
};

export function GreetingHero({
  name,
  dateLine,
  summaryParts,
  suffix,
  continueHref = "/courses",
}: GreetingHeroProps) {
  const greeting = greetingWord();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-[13px] text-ink-4">{dateLine}</div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em] text-ink">
          {greeting}，{name}
        </h1>
        {summaryParts.length > 0 && (
          <div className="mt-1 text-sm text-ink-3">
            你今天{" "}
            {summaryParts.map((p, i) => (
              <span key={p.label}>
                {i > 0 && "、"}
                <span className={TONE_CLASS[p.tone]}>
                  {p.value} {p.label}
                </span>
              </span>
            ))}
            {suffix && `，${suffix}`}
          </div>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/schedule">
            <CalendarDays className="size-[13px]" />
            我的课表
          </Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link href={continueHref}>
            <Play className="size-[11px]" />
            继续学习
          </Link>
        </Button>
      </div>
    </div>
  );
}
