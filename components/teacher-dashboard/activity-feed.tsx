"use client";

import { MessageSquare, HelpCircle, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { relativeTimeFromNow } from "@/lib/utils/dashboard-formatters";
import type {
  ActivityItem,
  TeacherTaskType,
} from "@/lib/utils/teacher-dashboard-transforms";

const TYPE_ICON: Record<TeacherTaskType, typeof MessageSquare> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">动态</h2>
        <span className="text-xs text-ink-4">最近 {items.length} 条</span>
      </header>
      {items.length === 0 ? (
        <Card className="py-6">
          <p className="text-center text-sm text-ink-4">暂无动态</p>
        </Card>
      ) : (
        <Card className="py-0 gap-0 overflow-hidden">
          {items.map((a, i) => {
            const Icon = TYPE_ICON[a.taskType];
            const normScore =
              a.score != null && a.maxScore != null && a.maxScore > 0
                ? Math.round((a.score / a.maxScore) * 100)
                : null;
            const verb = a.action === "graded" ? "完成了" : "提交了";
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-2.5 px-3.5 py-3",
                  i < items.length - 1 && "border-b border-line-2",
                )}
              >
                <div
                  aria-hidden="true"
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-paper-alt"
                >
                  <Icon className="size-[12px] text-ink-4" />
                </div>
                <div className="min-w-0 flex-1 text-[12px] leading-[1.55]">
                  <b className="text-ink">{a.who}</b>
                  <span className="text-ink-4"> {verb} </span>
                  <span className="text-ink">{a.taskName}</span>
                  {normScore != null && (
                    <span className="fs-num ml-1.5 font-semibold text-success">
                      {normScore} 分
                    </span>
                  )}
                  <div className="mt-0.5 text-[11px] text-ink-5">
                    {a.time ? relativeTimeFromNow(a.time) : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
