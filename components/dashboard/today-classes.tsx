"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { courseColorForId, tagColors } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

interface TodaySlot {
  id: string;
  courseId: string;
  courseTitle: string;
  timeLabel: string;
  classroom?: string | null;
  teacherName?: string | null;
  inProgress?: boolean;
  href?: string;
}

interface TodayClassesProps {
  slots: TodaySlot[];
  dayLabel: string;
}

export function TodayClasses({ slots, dayLabel }: TodayClassesProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">今日课程</h2>
        <span className="text-xs text-ink-4">
          {slots.length > 0 ? `${slots.length} 节 · ${dayLabel}` : dayLabel}
        </span>
      </header>
      {slots.length === 0 ? (
        <Card className="py-6">
          <p className="text-center text-sm text-ink-4">今日无课程</p>
        </Card>
      ) : (
        <Card className="py-0 gap-0 overflow-hidden">
          {slots.map((s, i) => {
            const tagKey = courseColorForId(s.courseId);
            const tagColor = tagColors[tagKey].fg;
            const row = (
              <div
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5",
                  i < slots.length - 1 && "border-b border-line-2",
                )}
              >
                <span
                  aria-hidden="true"
                  className="w-1 self-stretch rounded-sm"
                  style={{ backgroundColor: tagColor }}
                />
                <div className="fs-num w-[100px] shrink-0 text-[12.5px] text-ink-2">
                  {s.timeLabel}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink-2">
                    {s.courseTitle}
                  </div>
                  {(s.classroom || s.teacherName) && (
                    <div className="mt-0.5 truncate text-[11.5px] text-ink-4">
                      {[
                        s.classroom && `教室 ${s.classroom}`,
                        s.teacherName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
                {s.inProgress && (
                  <Badge
                    variant="secondary"
                    className="bg-success-soft text-success-deep"
                  >
                    进行中
                  </Badge>
                )}
                <ChevronRight className="size-[14px] shrink-0 text-ink-5" />
              </div>
            );
            return s.href ? (
              <Link
                key={s.id}
                href={s.href}
                className="block transition-colors hover:bg-surface-tint"
              >
                {row}
              </Link>
            ) : (
              <div key={s.id}>{row}</div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
