"use client";

import Link from "next/link";
import { MessageSquare, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TeacherCardProps {
  name: string | null;
  titleLine?: string | null;
  initial?: string;
}

export function TeacherCard({ name, titleLine, initial }: TeacherCardProps) {
  const displayName = name?.trim() || "任课教师";
  const displayInitial = initial || displayName.charAt(0) || "师";
  return (
    <Card className="py-0 gap-0">
      <div className="p-4">
        <div className="mb-3.5 flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand text-[15px] font-semibold text-brand-fg">
            {displayInitial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-ink-2">
              {displayName}
            </div>
            {titleLine && (
              <div className="text-[11.5px] text-ink-4">{titleLine}</div>
            )}
          </div>
        </div>
        <Button variant="secondary" size="sm" className="w-full" asChild>
          <Link href="/study-buddy">
            <MessageSquare className="size-[12px]" />
            向老师提问
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export interface MasteryItem {
  id: string;
  name: string;
  pct: number;
  locked?: boolean;
}

interface MasterySectionProps {
  items: MasteryItem[];
}

function masteryColor(pct: number, locked: boolean): {
  bg: string;
  text: string;
} {
  if (locked) return { bg: "bg-line-2", text: "text-ink-5" };
  if (pct >= 80) return { bg: "bg-success", text: "text-success" };
  if (pct >= 60) return { bg: "bg-ochre", text: "text-ochre" };
  return { bg: "bg-warn", text: "text-warn" };
}

export function MasterySection({ items }: MasterySectionProps) {
  if (items.length === 0) {
    return (
      <>
        <h3 className="mb-2.5 text-[13px] font-semibold text-ink-2">
          本章掌握度
        </h3>
        <Card className="py-0 gap-0">
          <div className="p-4 text-center text-[12px] text-ink-4">
            暂无评估数据
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <h3 className="mb-2.5 text-[13px] font-semibold text-ink-2">
        本章掌握度
      </h3>
      <Card className="py-0 gap-0">
        <div className="space-y-2.5 p-4">
          {items.map((m) => {
            const { bg, text } = masteryColor(m.pct, m.locked ?? false);
            return (
              <div key={m.id}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className={cn(m.locked ? "text-ink-5" : "text-ink-2")}>
                    {m.name}
                  </span>
                  <span className={cn("fs-num font-semibold", text)}>
                    {m.locked ? "未开始" : `${m.pct}%`}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-sm bg-line-2">
                  <div
                    className={cn("h-full rounded-sm", bg)}
                    style={{
                      width: `${m.locked ? 0 : Math.max(0, Math.min(100, m.pct))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

interface AiHintProps {
  text: string;
}

export function AiHint({ text }: AiHintProps) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-surface-tint p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Sparkles className="size-[13px] text-ochre" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ochre">
          学习伙伴建议
        </span>
      </div>
      <p className="text-[12.5px] leading-[1.5] text-ink-3">{text}</p>
    </div>
  );
}
