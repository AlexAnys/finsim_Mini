"use client";

import Link from "next/link";
import { courseColorForId, tagColors } from "@/lib/design/tokens";

export interface CourseProgressItem {
  id: string;
  name: string;
  progress: number;
}

interface CourseProgressSidebarProps {
  items: CourseProgressItem[];
}

export function CourseProgressSidebar({ items }: CourseProgressSidebarProps) {
  return (
    <section>
      <h2 className="mb-2.5 text-[15px] font-semibold text-ink-2">我的课程</h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4 text-center text-sm text-ink-4">
          暂无课程
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((c) => {
            const tagKey = courseColorForId(c.id);
            const tc = tagColors[tagKey];
            const progress = Math.max(0, Math.min(100, Math.round(c.progress)));
            const initial = c.name.trim().charAt(0) || "课";
            return (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 transition-colors hover:bg-surface-tint"
              >
                <div
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: tc.bg, color: tc.fg }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-2">
                    {c.name}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-line-2">
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${progress}%`, backgroundColor: tc.fg }}
                      />
                    </div>
                    <div className="fs-num text-[10.5px] text-ink-4">
                      {progress}%
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
