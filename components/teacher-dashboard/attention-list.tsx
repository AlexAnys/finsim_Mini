"use client";

import Link from "next/link";
import { MessageSquare, HelpCircle, FileText, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeDue } from "@/lib/utils/dashboard-formatters";
import type {
  AttentionItem,
  TeacherTaskType,
} from "@/lib/utils/teacher-dashboard-transforms";

const TYPE_CONFIG: Record<
  TeacherTaskType,
  {
    label: string;
    icon: typeof MessageSquare;
    soft: string;
    fg: string;
    chip: string;
  }
> = {
  simulation: {
    label: "模拟对话",
    icon: MessageSquare,
    soft: "bg-sim-soft",
    fg: "text-sim",
    chip: "bg-sim-soft text-sim border-sim/20",
  },
  quiz: {
    label: "测验",
    icon: HelpCircle,
    soft: "bg-quiz-soft",
    fg: "text-quiz",
    chip: "bg-quiz-soft text-quiz border-quiz/20",
  },
  subjective: {
    label: "主观题",
    icon: FileText,
    soft: "bg-subj-soft",
    fg: "text-subj",
    chip: "bg-subj-soft text-subj border-subj/20",
  },
};

interface AttentionListProps {
  items: AttentionItem[];
  seeAllHref?: string;
}

export function AttentionList({
  items,
  seeAllHref = "/teacher/tasks",
}: AttentionListProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-ink-2">需要你关注</h2>
          {items.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-warn-soft text-warn text-[10px] px-1.5 py-0"
            >
              {items.length}
            </Badge>
          )}
        </div>
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
        >
          全部任务
          <ArrowRight className="size-[11px]" />
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface py-6 text-center text-sm text-ink-4">
          暂无需要关注的任务
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((t, i) => {
            const cfg = TYPE_CONFIG[t.taskType];
            const Icon = cfg.icon;
            const dueInfo = t.dueAt ? formatRelativeDue(t.dueAt) : null;
            const pct =
              t.classSize > 0
                ? Math.min(100, Math.round((t.submissionCount / t.classSize) * 100))
                : 0;
            const barTone =
              pct >= 80
                ? "bg-success"
                : pct >= 50
                  ? "bg-brand"
                  : "bg-warn";

            // The first urgent item gets the amber hero treatment.
            const isHero = i === 0 && t.urgent;

            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border bg-surface px-4 py-3.5 shadow-fs",
                  isHero
                    ? "border-warn-soft border-l-[3px] border-l-warn"
                    : "border-line",
                )}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      cfg.soft,
                    )}
                  >
                    <Icon className={cn("size-[15px]", cfg.fg)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cfg.chip}>
                        {cfg.label}
                      </Badge>
                      {dueInfo && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[11px]",
                            dueInfo.isUrgent
                              ? "bg-warn-soft text-warn"
                              : "bg-paper-alt text-ink-3",
                          )}
                        >
                          {dueInfo.label}
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-[14px] font-medium text-ink">
                      {t.title}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-4">
                      {t.courseTitle && (
                        <span className="font-medium text-brand">
                          {t.courseTitle}
                        </span>
                      )}
                      {t.className && (
                        <>
                          <span className="mx-1.5 text-ink-5">·</span>
                          <span>{t.className}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="hidden w-[150px] shrink-0 items-center gap-2 sm:flex">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-2">
                      <div
                        className={cn("h-full rounded-full", barTone)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="fs-num w-[48px] shrink-0 text-right text-[11px] text-ink-3">
                      {t.submissionCount}/{t.classSize || "?"}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={t.hrefInstance}>查看</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
