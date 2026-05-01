"use client";

import Link from "next/link";
import { MessageSquare, HelpCircle, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubmissionAnalysisStatus } from "@/components/instance-detail/submissions-utils";

export interface RecentGradeItem {
  id: string;
  taskName: string;
  taskType: "simulation" | "quiz" | "subjective" | string;
  date: string;
  score: number;
  maxScore: number;
  status?: string;
  href?: string;
  // PR-SIM-1c · D1 防作弊：未公布的不渲染分数，改 chip
  analysisStatus?: SubmissionAnalysisStatus;
}

interface RecentGradesProps {
  items: RecentGradeItem[];
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; chip: string }
> = {
  simulation: {
    label: "模拟对话",
    icon: MessageSquare,
    chip: "bg-sim-soft text-sim border-sim/20",
  },
  quiz: {
    label: "测验",
    icon: HelpCircle,
    chip: "bg-quiz-soft text-quiz border-quiz/20",
  },
  subjective: {
    label: "主观题",
    icon: FileText,
    chip: "bg-subj-soft text-subj border-subj/20",
  },
};

function barColor(pct: number): string {
  if (pct >= 85) return "bg-success";
  if (pct >= 70) return "bg-ochre";
  return "bg-warn";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

export function RecentGrades({ items }: RecentGradesProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">最近成绩</h2>
        <Link
          href="/grades"
          className="text-xs text-brand transition-colors hover:text-brand-deep"
        >
          查看全部 →
        </Link>
      </header>
      {items.length === 0 ? (
        <Card className="py-6">
          <p className="text-center text-sm text-ink-4">暂无成绩</p>
        </Card>
      ) : (
        <Card className="py-0 gap-0 overflow-hidden">
          {items.map((r, i) => {
            const cfg = TYPE_CONFIG[r.taskType];
            const pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
            const Icon = cfg?.icon;
            const isReleased = !r.analysisStatus || r.analysisStatus === "released";
            const body = (
              <div
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3",
                  i < items.length - 1 && "border-b border-line-2",
                )}
              >
                {cfg ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 gap-1",
                      cfg.chip,
                    )}
                  >
                    {Icon && <Icon className="size-[11px]" />}
                    {cfg.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">
                    {r.taskType}
                  </Badge>
                )}
                <div className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">
                  {r.taskName}
                </div>
                <div className="fs-num hidden w-16 shrink-0 text-right text-[11.5px] text-ink-4 md:block">
                  {formatDate(r.date)}
                </div>
                {isReleased ? (
                  <div className="flex w-[140px] shrink-0 items-center gap-2.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-sm bg-line-2">
                      <div
                        className={cn("h-full rounded-sm", barColor(pct))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="fs-num w-[50px] text-right text-[13px] font-semibold">
                      <span className="text-ink">{r.score}</span>
                      <span className="text-ink-5">/{r.maxScore}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-[140px] shrink-0 justify-end">
                    {r.status === "failed" ? (
                      <Badge
                        variant="outline"
                        className="border-danger/20 bg-danger-soft text-danger"
                      >
                        批改失败
                      </Badge>
                    ) : r.status === "grading" ? (
                      <Badge
                        variant="outline"
                        className="border-brand/20 bg-brand-soft text-brand"
                      >
                        批改中
                      </Badge>
                    ) : r.analysisStatus === "pending" ? (
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground border-line-2"
                      >
                        等待 AI 分析
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-ochre/10 text-ochre border-ochre/20"
                      >
                        已分析 · 等待教师公布
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
            return r.href ? (
              <Link
                key={r.id}
                href={r.href}
                className="block transition-colors hover:bg-surface-tint"
              >
                {body}
              </Link>
            ) : (
              <div key={r.id}>{body}</div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
