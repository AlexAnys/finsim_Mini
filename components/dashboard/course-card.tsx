"use client";

import Link from "next/link";
import { CalendarDays, ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { courseColorForId, tagColors } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

export interface CourseCardData {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  classNames: string[];
  progress: number;
  submittedCount: number;
  totalTasks: number;
  avgScore: number | null;
  nextLesson: {
    title: string;
    date: string;
    classroom: string | null;
  } | null;
}

interface CourseCardProps {
  data: CourseCardData;
}

export function CourseCard({ data: c }: CourseCardProps) {
  const tagKey = courseColorForId(c.id);
  const tc = tagColors[tagKey];

  const isDone = c.progress >= 100;
  const isBehind = c.progress < 15 && !isDone;

  return (
    <Link
      href={`/courses/${c.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-fs transition-shadow hover:shadow-fs-lg"
    >
      {/* Header with top color bar */}
      <div className="relative border-b border-line-2 px-5 pt-[18px] pb-3.5">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ backgroundColor: tc.fg, opacity: 0.9 }}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {c.courseCode && (
                <span
                  className="fs-num rounded px-2 py-[2px] text-[11px] font-semibold"
                  style={{ backgroundColor: tc.bg, color: tc.fg }}
                >
                  {c.courseCode}
                </span>
              )}
              {c.classNames.length > 0 && (
                <span className="text-[11px] text-ink-5">·</span>
              )}
              {c.classNames.map((n, i) => (
                <span key={`${n}-${i}`} className="text-[11.5px] text-ink-4">
                  {n}
                </span>
              ))}
            </div>
            <h3 className="text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink">
              {c.courseTitle}
            </h3>
            {c.description && (
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.5] text-ink-4">
                {c.description}
              </p>
            )}
          </div>
          {isDone && (
            <Badge
              variant="secondary"
              className="shrink-0 bg-success-soft text-success-deep"
            >
              <Check className="size-[11px]" />
              已完成
            </Badge>
          )}
          {isBehind && (
            <Badge
              variant="secondary"
              className="shrink-0 bg-warn-soft text-warn"
            >
              进度落后
            </Badge>
          )}
        </div>
      </div>

      {/* Progress row on surface-tint */}
      <div className="border-b border-line-2 bg-surface-tint px-5 py-3.5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-medium text-ink-3">课程进度</span>
          <span className="fs-num text-[13px] font-semibold text-ink-2">
            <span className="text-ink-2">{c.submittedCount}</span>
            <span className="font-normal text-ink-5">/{c.totalTasks}</span>
            <span className="ml-1 text-ink-4 font-normal">任务</span>
            <span
              className={cn(
                "ml-2",
                isDone ? "text-success" : "text-brand",
              )}
            >
              {c.progress}%
            </span>
          </span>
        </div>
        <div className="h-[5px] overflow-hidden rounded-sm bg-line-2">
          <div
            className={cn(
              "h-full rounded-sm transition-[width]",
              isDone ? "bg-success" : "bg-brand",
            )}
            style={{ width: `${Math.max(0, Math.min(100, c.progress))}%` }}
          />
        </div>
      </div>

      {/* Next lesson + stats + CTA */}
      <div className="flex items-center gap-3.5 px-5 pt-3.5 pb-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-5">
            {isDone ? "结课任务" : "下次课"}
          </div>
          {c.nextLesson ? (
            <>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-[13px] shrink-0 text-brand" />
                <span className="truncate text-[13px] font-medium text-ink-2">
                  {c.nextLesson.title}
                </span>
              </div>
              <div className="mt-0.5 pl-[21px] text-[11.5px] text-ink-4">
                {c.nextLesson.date}
                {c.nextLesson.classroom && ` · ${c.nextLesson.classroom}`}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-ink-4">暂无安排</div>
          )}
        </div>

        <div className="hidden shrink-0 gap-3.5 pr-1 md:flex">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-ink-5">
              任务
            </div>
            <div className="fs-num text-[14px] font-semibold text-ink">
              {c.submittedCount}
              <span className="text-[11.5px] font-normal text-ink-4">
                /{c.totalTasks}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-ink-5">
              均分
            </div>
            <div className="fs-num text-[14px] font-semibold text-ink">
              {c.avgScore != null ? c.avgScore : "—"}
              {c.avgScore != null && (
                <span className="ml-0.5 text-[11.5px] font-normal text-ink-4">
                  分
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="default"
          className="shrink-0 pointer-events-none"
        >
          进入
          <ArrowRight className="size-[12px]" />
        </Button>
      </div>
    </Link>
  );
}
