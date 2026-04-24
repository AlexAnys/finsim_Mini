"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ClassPerformanceRow,
  WeeklyTrendPoint,
} from "@/lib/utils/teacher-dashboard-transforms";

interface PerformanceChartProps {
  overallAvg: number | null;
  overallDelta: number | null;
  classes: ClassPerformanceRow[];
  weeklyTrend: WeeklyTrendPoint[];
}

export function PerformanceChart({
  overallAvg,
  overallDelta,
  classes,
  weeklyTrend,
}: PerformanceChartProps) {
  const chart = useMemo(() => buildChart(weeklyTrend), [weeklyTrend]);

  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">班级表现</h2>
        <div className="flex items-center gap-1 text-[11.5px]">
          <span className="rounded-md bg-ink-2 px-2 py-[3px] font-medium text-[var(--fs-primary-fg)]">
            本周
          </span>
          <span className="rounded-md px-2 py-[3px] text-ink-4">本月</span>
          <span className="rounded-md px-2 py-[3px] text-ink-4">学期</span>
        </div>
      </header>

      <Card className="py-0 gap-0">
        <CardContent className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          {/* Left: overall avg + per-class bars */}
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-4">
              平均得分趋势
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="fs-num text-[32px] font-semibold tracking-[-0.03em] text-ink">
                {overallAvg != null ? overallAvg.toFixed(1) : "—"}
              </span>
              {overallDelta != null && (
                <span className="fs-num inline-flex items-center gap-0.5 text-xs font-medium text-success">
                  <TrendingUp className="size-[11px]" />
                  {overallDelta > 0 ? "+" : ""}
                  {overallDelta} 较上周
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              {classes.length === 0 ? (
                <p className="text-[12px] text-ink-4">
                  暂无班级均分，待批改后自动汇总
                </p>
              ) : (
                classes.slice(0, 4).map((c, i) => (
                  <div
                    key={c.classId}
                    className="flex items-center gap-2 py-0.5 text-[12px]"
                  >
                    <div className="w-[80px] truncate text-ink-3">
                      {c.className}
                    </div>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-2">
                      <div
                        className={i === 0 ? "h-full bg-success" : "h-full bg-brand"}
                        style={{
                          width: `${Math.min(100, c.avgScore)}%`,
                          opacity: i === 0 ? 1 : Math.max(0.5, 1 - i * 0.15),
                        }}
                      />
                    </div>
                    <div className="fs-num w-[38px] text-right text-ink-2">
                      {c.avgScore.toFixed(1)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: 8-week trend chart */}
          <div className="md:border-l md:border-line md:pl-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-4">
              8 周提交量 & 均分
            </div>
            <svg
              className="mt-3 w-full"
              viewBox="0 0 400 140"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="fs-teacher-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--fs-primary)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--fs-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  x1="0"
                  y1={i * 35 + 10}
                  x2="400"
                  y2={i * 35 + 10}
                  stroke="var(--fs-line-2)"
                  strokeWidth="1"
                />
              ))}
              {chart.bars.map((b, i) => (
                <rect
                  key={i}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx="2"
                  fill="var(--fs-accent-soft)"
                />
              ))}
              {chart.areaPath && (
                <path d={chart.areaPath} fill="url(#fs-teacher-area)" />
              )}
              {chart.linePath && (
                <path
                  d={chart.linePath}
                  fill="none"
                  stroke="var(--fs-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {chart.dots.map((d, i) => (
                <circle
                  key={i}
                  cx={d.x}
                  cy={d.y}
                  r="3"
                  fill="var(--fs-surface)"
                  stroke="var(--fs-primary)"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            <div className="fs-num mt-1 flex justify-between text-[10.5px] text-ink-5">
              {weeklyTrend.map((p) => (
                <span key={p.weekLabel}>{p.weekLabel}</span>
              ))}
            </div>
            <div className="mt-2.5 flex gap-4 text-[11.5px] text-ink-4">
              <div className="flex items-center gap-1.5">
                <div className="h-[2px] w-[10px] bg-brand" /> 班级均分
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-[8px] w-[10px] bg-ochre-soft" /> 提交量
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function buildChart(points: WeeklyTrendPoint[]) {
  const n = points.length;
  if (n === 0) {
    return { bars: [], dots: [], areaPath: "", linePath: "" };
  }
  const width = 400;
  const baseline = 130;
  const plotTop = 10;
  const plotH = 100;

  const step = width / (n - 1 || 1);
  const maxBar = Math.max(1, ...points.map((p) => p.submissionCount));
  const maxScore = 100;

  const bars = points.map((p, i) => {
    const h = Math.round((p.submissionCount / maxBar) * plotH);
    return {
      x: i * step - 14 + (i === 0 ? 0 : 0),
      y: baseline - h,
      w: 26,
      h,
    };
  });

  const scoreDots: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.avgScore == null) return;
    const x = i * step;
    const y = plotTop + plotH - (p.avgScore / maxScore) * plotH;
    scoreDots.push({ x, y });
  });

  if (scoreDots.length === 0) {
    return { bars, dots: [], areaPath: "", linePath: "" };
  }

  const linePath =
    "M " +
    scoreDots.map((d) => `${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(" L ");
  const areaPath =
    linePath +
    ` L ${scoreDots[scoreDots.length - 1].x.toFixed(1)} ${baseline} L ${scoreDots[0].x.toFixed(1)} ${baseline} Z`;

  return { bars, dots: scoreDots, areaPath, linePath };
}
