"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  ClassPerformanceRow,
  CourseClassPerformanceRow,
  CourseClassWeeklyTrendSeries,
  PerformanceCourseOption,
  WeeklyTrendPoint,
} from "@/lib/utils/teacher-dashboard-transforms";

interface PerformanceChartProps {
  /** 总均分（聚合视图，全部课程时显示） */
  overallAvg: number | null;
  overallDelta: number | null;
  /** 总班级表现（聚合视图，全部课程时显示） */
  classes: ClassPerformanceRow[];
  /** 总周趋势（聚合视图，全部课程时显示单条线） */
  weeklyTrend: WeeklyTrendPoint[];
  /** 课程下拉选项 */
  courseOptions: PerformanceCourseOption[];
  /** 选中课程下的班级聚合（仅在选中课程时使用） */
  courseClasses: CourseClassPerformanceRow[];
  /** 选中课程下的多班级周趋势（仅在选中课程时使用） */
  courseClassWeekly: CourseClassWeeklyTrendSeries[];
  /** 当前选中课程；null = 聚合视图 */
  selectedCourseId: string | null;
  /** 切换选中课程 */
  onCourseChange: (next: string | null) => void;
}

// 班级对比模式下使用的 4 种 token 色 + fallback
const SERIES_TOKENS = [
  {
    line: "var(--fs-success)",
    soft: "var(--fs-success-soft)",
    chip: "bg-success-soft text-success",
    dot: "bg-success",
  },
  {
    line: "var(--fs-info)",
    soft: "var(--fs-info-soft)",
    chip: "bg-info-soft text-info",
    dot: "bg-info",
  },
  {
    line: "var(--fs-warn)",
    soft: "var(--fs-warn-soft)",
    chip: "bg-warn-soft text-warn",
    dot: "bg-warn",
  },
  {
    line: "var(--fs-danger)",
    soft: "var(--fs-danger-soft)",
    chip: "bg-danger-soft text-danger",
    dot: "bg-danger",
  },
] as const;

const FALLBACK_TOKEN = {
  line: "var(--fs-ink-5)",
  soft: "var(--fs-line-2)",
  chip: "bg-paper-alt text-ink-3",
  dot: "bg-ink-5",
} as const;

function getSeriesToken(index: number) {
  return SERIES_TOKENS[index] ?? FALLBACK_TOKEN;
}

const ALL_COURSES = "__all__";

export function PerformanceChart({
  overallAvg,
  overallDelta,
  classes,
  weeklyTrend,
  courseOptions,
  courseClasses,
  courseClassWeekly,
  selectedCourseId,
  onCourseChange,
}: PerformanceChartProps) {
  const isMulti = selectedCourseId != null && courseClassWeekly.length > 0;
  const [timeWindow, setTimeWindow] = useState<"week" | "month" | "term">(
    "week",
  );

  const aggregateChart = useMemo(() => buildChart(weeklyTrend), [weeklyTrend]);
  const multiChart = useMemo(
    () => (isMulti ? buildMultiChart(courseClassWeekly) : null),
    [courseClassWeekly, isMulti],
  );

  const handleCourseValueChange = (next: string) => {
    onCourseChange(next === ALL_COURSES ? null : next);
  };

  return (
    <section>
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink-2">班级表现</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedCourseId ?? ALL_COURSES}
            onValueChange={handleCourseValueChange}
          >
            <SelectTrigger
              size="sm"
              className="h-7 min-w-[140px] text-xs"
              aria-label="按课程筛选班级表现"
            >
              <SelectValue placeholder="全部课程" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COURSES}>全部课程</SelectItem>
              {courseOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            role="radiogroup"
            aria-label="时间维度"
            className="flex items-center gap-1 text-[11.5px]"
          >
            {(
              [
                { value: "week", label: "本周" },
                { value: "month", label: "本月" },
                { value: "term", label: "学期" },
              ] as const
            ).map((opt) => {
              const active = timeWindow === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTimeWindow(opt.value)}
                  className={cn(
                    "rounded-md px-2 py-[3px] font-medium transition-colors",
                    active
                      ? "bg-ink-2 text-[var(--fs-primary-fg)]"
                      : "text-ink-4 hover:text-ink-2",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <Card className="py-0 gap-0">
        <CardContent className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          {/* Left: per-class summary */}
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-4">
              平均得分趋势
            </div>
            {!isMulti ? (
              <>
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
                            className={
                              i === 0 ? "h-full bg-success" : "h-full bg-brand"
                            }
                            style={{
                              width: `${Math.min(100, c.avgScore)}%`,
                              opacity:
                                i === 0 ? 1 : Math.max(0.5, 1 - i * 0.15),
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
              </>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                {courseClasses.length === 0 ? (
                  <p className="text-[12px] text-ink-4">
                    所选课程暂无班级表现数据
                  </p>
                ) : (
                  courseClasses.slice(0, 5).map((c, i) => {
                    const token = getSeriesToken(i);
                    const widthPct =
                      c.avgScore != null ? Math.min(100, c.avgScore) : 0;
                    return (
                      <div
                        key={c.classId}
                        className="flex items-center gap-2 py-0.5 text-[12px]"
                      >
                        <div
                          className={cn("size-2 shrink-0 rounded-full", token.dot)}
                          aria-hidden
                        />
                        <div className="w-[72px] truncate text-ink-3">
                          {c.className}
                        </div>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-2">
                          <div
                            className="h-full"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: token.line,
                            }}
                          />
                        </div>
                        <div className="fs-num w-[38px] text-right text-ink-2">
                          {c.avgScore != null ? c.avgScore.toFixed(1) : "—"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Right: weekly trend chart */}
          <div className="md:border-l md:border-line md:pl-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-4">
              8 周提交量 & 均分
            </div>

            {!isMulti ? (
              <>
                <svg
                  className="mt-3 w-full"
                  viewBox="0 0 400 140"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="fs-teacher-area"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--fs-primary)"
                        stopOpacity="0.25"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--fs-primary)"
                        stopOpacity="0"
                      />
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
                  {aggregateChart.bars.map((b, i) => (
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
                  {aggregateChart.areaPath && (
                    <path
                      d={aggregateChart.areaPath}
                      fill="url(#fs-teacher-area)"
                    />
                  )}
                  {aggregateChart.linePath && (
                    <path
                      d={aggregateChart.linePath}
                      fill="none"
                      stroke="var(--fs-primary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {aggregateChart.dots.map((d, i) => (
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
              </>
            ) : multiChart ? (
              <>
                <svg
                  className="mt-3 w-full"
                  viewBox="0 0 400 140"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
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
                  {/* Grouped bars: each week N classes side-by-side */}
                  {multiChart.barGroups.map((group) =>
                    group.bars.map((bar) => (
                      <rect
                        key={`${bar.classId}-${group.weekIndex}`}
                        x={bar.x}
                        y={bar.y}
                        width={bar.w}
                        height={bar.h}
                        rx="1.5"
                        fill={bar.fill}
                        opacity="0.55"
                      />
                    )),
                  )}
                  {/* Multi lines */}
                  {multiChart.lines.map((ln) => (
                    <g key={ln.classId}>
                      {ln.linePath && (
                        <path
                          d={ln.linePath}
                          fill="none"
                          stroke={ln.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {ln.dots.map((d, di) => (
                        <circle
                          key={di}
                          cx={d.x}
                          cy={d.y}
                          r="3"
                          fill="var(--fs-surface)"
                          stroke={ln.color}
                          strokeWidth="1.5"
                        />
                      ))}
                    </g>
                  ))}
                </svg>
                <div className="fs-num mt-1 flex justify-between text-[10.5px] text-ink-5">
                  {multiChart.weekLabels.map((lbl) => (
                    <span key={lbl}>{lbl}</span>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-3 text-[11.5px] text-ink-4">
                  {courseClassWeekly.slice(0, 5).map((s, i) => {
                    const token = getSeriesToken(i);
                    return (
                      <div
                        key={s.classId}
                        className="flex items-center gap-1.5"
                      >
                        <span
                          className={cn(
                            "inline-block size-2 rounded-full",
                            token.dot,
                          )}
                          aria-hidden
                        />
                        <span>{s.className}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
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

function buildMultiChart(series: CourseClassWeeklyTrendSeries[]) {
  if (series.length === 0) {
    return {
      lines: [] as Array<{
        classId: string;
        color: string;
        linePath: string;
        dots: Array<{ x: number; y: number }>;
      }>,
      barGroups: [] as Array<{
        weekIndex: number;
        bars: Array<{
          classId: string;
          x: number;
          y: number;
          w: number;
          h: number;
          fill: string;
        }>;
      }>,
      weekLabels: [] as string[],
    };
  }
  const n = series[0].weeklyData.length;
  const width = 400;
  const baseline = 130;
  const plotTop = 10;
  const plotH = 100;
  const step = width / (n - 1 || 1);
  const maxScore = 100;

  // 全局最大提交量（跨所有班级所有周）— 用于柱状图归一化
  let maxBar = 1;
  for (const s of series) {
    for (const p of s.weeklyData) {
      if (p.submissionCount > maxBar) maxBar = p.submissionCount;
    }
  }

  // grouped bars 配置：每个 week 内 N 个 bar 并排，总宽度 < step
  const groupWidth = Math.min(28, step * 0.7);
  const barW = Math.max(2, Math.floor(groupWidth / Math.max(1, series.length)));

  const lines = series.slice(0, 5).map((s, idx) => {
    const token = getSeriesToken(idx);
    const dots: Array<{ x: number; y: number }> = [];
    s.weeklyData.forEach((p, i) => {
      if (p.avgScore == null) return;
      const x = i * step;
      const y = plotTop + plotH - (p.avgScore / maxScore) * plotH;
      dots.push({ x, y });
    });
    const linePath =
      dots.length > 0
        ? "M " +
          dots.map((d) => `${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(" L ")
        : "";
    return {
      classId: s.classId,
      color: token.line,
      linePath,
      dots,
    };
  });

  // grouped bars by week
  const limitedSeries = series.slice(0, 5);
  const barGroups: Array<{
    weekIndex: number;
    bars: Array<{
      classId: string;
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
    }>;
  }> = [];
  for (let weekIndex = 0; weekIndex < n; weekIndex++) {
    const weekCenter = weekIndex * step;
    const groupStart = weekCenter - groupWidth / 2;
    const bars: Array<{
      classId: string;
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
    }> = [];
    limitedSeries.forEach((s, idx) => {
      const token = getSeriesToken(idx);
      const point = s.weeklyData[weekIndex];
      if (!point) return;
      const h = Math.round((point.submissionCount / maxBar) * plotH);
      bars.push({
        classId: s.classId,
        x: groupStart + idx * barW,
        y: baseline - h,
        w: Math.max(1, barW - 1),
        h,
        fill: token.line,
      });
    });
    barGroups.push({ weekIndex, bars });
  }

  const weekLabels = series[0].weeklyData.map((p) => p.weekLabel);

  return { lines, barGroups, weekLabels };
}
