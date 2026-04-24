"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChapterStatus = "done" | "active" | "upcoming";

export interface ChapterNavItem {
  id: string;
  number: number;
  title: string;
  status: ChapterStatus;
}

interface ChapterNavProps {
  items: ChapterNavItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ChapterNav({ items, activeId, onSelect }: ChapterNavProps) {
  return (
    <nav aria-label="章节导航" className="lg:sticky lg:top-[70px]">
      <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
        课程章节
      </div>
      <ul className="space-y-0.5">
        {items.map((c) => {
          const isActive = c.id === activeId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-brand-soft text-brand"
                    : "text-ink-3 hover:bg-paper",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold",
                    c.status === "done" &&
                      "bg-success text-white",
                    c.status === "active" &&
                      "bg-brand text-brand-fg",
                    c.status === "upcoming" && "bg-line text-ink-4",
                  )}
                  aria-label={c.status === "done" ? "已完成" : c.status === "active" ? "进行中" : "未开始"}
                >
                  {c.status === "done" ? (
                    <Check className="size-[11px]" strokeWidth={2.5} />
                  ) : (
                    <span className="fs-num">{c.number}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "flex-1 text-[12.5px] leading-tight",
                    isActive && "font-semibold",
                  )}
                >
                  {c.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
