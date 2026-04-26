"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { courseColorForId, tagColors } from "@/lib/design/tokens";
import type { TeacherUpcomingSlot } from "@/lib/utils/teacher-dashboard-transforms";

interface TodayScheduleProps {
  slots: TeacherUpcomingSlot[];
}

export function TodaySchedule({ slots }: TodayScheduleProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">近期课表</h2>
        <span className="text-xs text-ink-4">
          {slots.length > 0 ? `未来 ${slots.length} 节课` : "未来无课程"}
        </span>
      </header>
      {slots.length === 0 ? (
        <Card className="py-6">
          <p className="text-center text-sm text-ink-4">近期暂无课程</p>
        </Card>
      ) : (
        <Card className="py-0 gap-0 overflow-hidden">
          {slots.map((s, i) => {
            const tc = tagColors[courseColorForId(s.courseId)];
            return (
              <div
                key={`${s.id}-${s.date}`}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3",
                  i < slots.length - 1 && "border-b border-line-2",
                  s.inProgress && "bg-success-soft/40",
                )}
              >
                <div className="w-[58px] shrink-0">
                  <div className="fs-num text-[12.5px] font-semibold text-ink-2">
                    {s.dateLabel}
                  </div>
                  <div className="text-[10.5px] text-ink-4">{s.weekdayLabel}</div>
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
                    <span className="fs-num text-ink-3">{s.startTime}</span>
                    {(s.className || s.classroom) && (
                      <>
                        <span className="mx-1 text-ink-5">·</span>
                        {[s.className, s.classroom].filter(Boolean).join(" · ")}
                      </>
                    )}
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
                {s.isToday && !s.inProgress && (
                  <Badge
                    variant="secondary"
                    className="bg-brand-soft text-brand text-[10px]"
                  >
                    今天
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
