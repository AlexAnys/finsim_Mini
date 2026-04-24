"use client";

import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="flex flex-shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/teacher/ai-assistant">
            <Sparkles className="size-[13px]" />
            AI 生成任务
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/teacher/tasks/new">
            <Plus className="size-[13px]" />
            新建任务
          </Link>
        </Button>
      </div>
    </div>
  );
}
