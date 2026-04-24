"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { courseColorForId, tagColors } from "@/lib/design/tokens";
import type { TeacherTodaySlot } from "@/lib/utils/teacher-dashboard-transforms";

interface TodayScheduleProps {
  slots: TeacherTodaySlot[];
  dayLabel: string;
}

export function TodaySchedule({ slots, dayLabel }: TodayScheduleProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">今日课表</h2>
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
            const tc = tagColors[courseColorForId(s.courseId)];
            const startTime = s.timeLabel.split(/[-~]/)[0]?.trim() ?? "";
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3",
                  i < slots.length - 1 && "border-b border-line-2",
                  s.inProgress && "bg-success-soft/40",
                )}
              >
                <div className="fs-num w-[46px] shrink-0 text-[12.5px] font-semibold text-ink-2">
                  {startTime}
                </div>
                <div
                  aria-hidden="true"
                  className="w-[3px] self-stretch rounded-sm"
                  style={{ backgroundColor: tc.fg }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-2">
                    {s.courseTitle}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-4">
                    {[s.className, s.classroom].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                {s.inProgress && (
                  <Badge
                    variant="secondary"
                    className="bg-success-soft text-success-deep text-[10px]"
                  >
                    进行中
                  </Badge>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
