"use client";

import { useMemo } from "react";
import { Flame, Sparkles, CheckCircle2, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildFunnel,
  formatCountdown,
  type OverviewStats,
} from "./overview-utils";

export type { OverviewStats } from "./overview-utils";

export interface OverviewTabProps {
  instance: {
    id: string;
    title: string;
    description: string | null;
    taskType: string;
    dueAt: string;
    publishedAt: string | null;
    createdAt: string;
  };
  stats: OverviewStats;
  onRemind: () => void;
  onStartGrading: () => void;
  onPreviewStudent: () => void;
}

export function OverviewTab({
  instance,
  stats,
  onRemind,
  onStartGrading,
  onPreviewStudent,
}: OverviewTabProps) {
  const funnel = useMemo(() => buildFunnel(stats), [stats]);

  const countdown = formatCountdown(instance.dueAt);
  const unsubmitted = Math.max(stats.assigned - stats.submitted, 0);
  const awaitingGrading = stats.grading;

  const publishedLabel = instance.publishedAt
    ? new Date(instance.publishedAt).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未发布";

  const dueLabel = new Date(instance.dueAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      id="tabpanel-overview"
      role="tabpanel"
      aria-labelledby="tab-overview"
      className="grid gap-5 md:grid-cols-[2fr_1fr]"
    >
      {/* LEFT */}
      <div className="flex flex-col gap-4">
        {/* 交付漏斗 */}
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">交付漏斗</h2>
          <div className="mt-3.5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {funnel.map((f) => {
              const safePct = Math.max(0, Math.min(1, f.pct));
              return (
                <div key={f.key}>
                  <div className="text-[11px] font-medium uppercase tracking-[0.8px] text-ink-5">
                    {f.label}
                  </div>
                  <div className="mt-1 text-[26px] font-bold tabular-nums tracking-[-0.02em] text-ink md:text-[28px]">
                    {f.value}
                    <span className="ml-1 text-sm font-medium text-ink-5">
                      /{stats.assigned || 0}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-paper-alt">
                    <div
                      className={`h-full rounded ${f.barClass}`}
                      style={{ width: `${safePct * 100}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11px] text-ink-4">{f.sub}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 任务说明 */}
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">任务说明</h2>
          {instance.description ? (
            <p className="mt-2 text-xs leading-relaxed text-ink-3">
              {instance.description}
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink-5">（未填写任务说明）</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={onPreviewStudent}
          >
            预览学生视角
          </Button>
        </section>
      </div>

      {/* RIGHT */}
      <div className="flex flex-col gap-4">
        {/* 需要你处理 */}
        <section className="rounded-xl border border-line bg-surface p-[18px] border-l-[3px] border-l-warn">
          <div className="text-[13px] font-semibold text-ink">需要你处理</div>
          <p className="mt-0.5 mb-3 text-[11.5px] text-ink-4">
            打开页面先看这里
          </p>

          {unsubmitted === 0 && awaitingGrading === 0 ? (
            <div className="py-4 text-center text-xs text-ink-5">
              暂无需要处理的事项
            </div>
          ) : (
            <ul className="divide-y divide-line-2">
              {unsubmitted > 0 && (
                <li className="flex items-center gap-2.5 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-danger-soft text-danger">
                    <Flame className="size-[13px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-ink-2">
                      {unsubmitted} 名学生未提交
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-5">
                      {countdown.text}
                    </div>
                  </div>
                  <Button variant="outline" size="xs" onClick={onRemind}>
                    催交
                  </Button>
                </li>
              )}
              {awaitingGrading > 0 && (
                <li className="flex items-center gap-2.5 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-warn-soft text-warn">
                    <CheckCircle2 className="size-[13px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-ink-2">
                      {awaitingGrading} 份等待你批改
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-5">
                      AI 初判已完成
                    </div>
                  </div>
                  <Button variant="outline" size="xs" onClick={onStartGrading}>
                    开始
                  </Button>
                </li>
              )}
              {stats.graded > 0 && (
                <li className="flex items-center gap-2.5 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sim-soft text-sim">
                    <Sparkles className="size-[13px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-ink-2">
                      AI 洞察已就绪
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-5">
                      共 {stats.graded} 份已出分
                    </div>
                  </div>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* 截止倒计时 */}
        <section className="rounded-xl border border-line bg-surface p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Clock className="size-[14px]" />
            截止倒计时
          </div>
          <div
            className={`mt-2 text-[22px] font-bold tabular-nums ${
              countdown.tone === "danger"
                ? "text-danger"
                : countdown.tone === "warn"
                ? "text-warn"
                : "text-ink"
            }`}
          >
            {countdown.text}
          </div>
          <dl className="mt-3 space-y-1.5 text-[11.5px] text-ink-4">
            <div className="flex items-center gap-2">
              <Calendar className="size-3" />
              <dt>截止</dt>
              <dd className="font-medium text-ink-3">{dueLabel}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-3" />
              <dt>发布</dt>
              <dd className="font-medium text-ink-3">{publishedLabel}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
