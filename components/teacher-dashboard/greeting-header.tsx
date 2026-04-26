"use client";

import { AiSuggestCallout } from "@/components/teacher-dashboard/ai-suggest-callout";

interface GreetingHeaderProps {
  dateLine: string;
  todayClassCount: number;
  pendingGradeCount: number;
  publishedThisWeek: number;
}

export function TeacherGreetingHeader({
  dateLine,
  todayClassCount,
  pendingGradeCount,
  publishedThisWeek,
}: GreetingHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-[13px] text-ink-4">{dateLine}</div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em] text-ink">
          教学工作台
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          今日 <b className="text-brand">{todayClassCount} 节课</b>
          <span className="mx-1.5 text-ink-5">·</span>
          待批 <b className="text-warn">{pendingGradeCount} 份</b>
          <span className="mx-1.5 text-ink-5">·</span>
          本周新发布 <b className="text-ink">{publishedThisWeek} 项任务</b>
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <AiSuggestCallout variant="header-chip" />
      </div>
    </div>
  );
}
