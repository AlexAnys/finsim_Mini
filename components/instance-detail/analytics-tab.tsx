"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
  buildHistogram,
  buildScatter,
  computeKPIs,
  formatMinutes,
  formatRate,
  formatScore,
  type HistogramBucket,
  type ScatterPoint,
} from "./analytics-utils";
import type { NormalizedSubmission } from "./submissions-utils";

export interface AnalyticsTabProps {
  rows: NormalizedSubmission[];
  taskType: "simulation" | "quiz" | "subjective" | string;
}

export function AnalyticsTab({ rows, taskType }: AnalyticsTabProps) {
  const kpi = useMemo(() => computeKPIs(rows), [rows]);
  const histogram = useMemo(() => buildHistogram(rows), [rows]);
  const scatter = useMemo(() => buildScatter(rows), [rows]);

  const empty = kpi.gradedCount === 0;

  return (
    <div
      id="tabpanel-analytics"
      role="tabpanel"
      aria-labelledby="tab-analytics"
      className="space-y-4"
    >
      {/* KPI strip — 4 cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="均分"
          value={formatScore(kpi.avgScore)}
          hint={kpi.gradedCount > 0 ? `已批 ${kpi.gradedCount}` : "暂无批改"}
          tone="brand"
        />
        <KpiCard
          label="中位数"
          value={formatScore(kpi.medianScore)}
          hint="50% 学生分布点"
          tone="ink"
        />
        <KpiCard
          label="及格率"
          value={formatRate(kpi.passRate)}
          hint={`≥ 60% 满分计为通过`}
          tone={kpi.passRate != null && kpi.passRate < 0.6 ? "warn" : "success"}
        />
        <KpiCard
          label="平均用时"
          value={formatMinutes(kpi.avgDurationSeconds)}
          hint={
            kpi.avgDurationSeconds == null
              ? "无用时数据"
              : `共 ${kpi.gradedCount} 份`
          }
          tone="ink"
        />
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-line bg-surface py-12 text-center">
          <BarChart3 className="mx-auto size-8 text-ink-5" />
          <div className="mt-3 text-sm font-medium text-ink-3">
            暂无可分析数据
          </div>
          <p className="mt-1 text-[12px] text-ink-5">
            等学生提交并完成 AI 批改后，分布与散点图会在这里出现
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 分数分布 */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <header className="mb-3 flex items-baseline justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">分数分布</h2>
                <p className="mt-0.5 text-[11px] text-ink-5">
                  按 0–100 归一化 · 6 档
                </p>
              </div>
              <span className="text-[11px] tabular-nums text-ink-5">
                共 {kpi.gradedCount} 份
              </span>
            </header>
            <Histogram buckets={histogram} />
          </section>

          {/* 耗时 vs 得分散点 */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <header className="mb-3 flex items-baseline justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">耗时 vs 得分</h2>
                <p className="mt-0.5 text-[11px] text-ink-5">
                  每个点是一份提交
                </p>
              </div>
              <span className="text-[11px] tabular-nums text-ink-5">
                {scatter.length} 点
              </span>
            </header>
            {scatter.length === 0 ? (
              <EmptyChart label="此任务类型无用时数据（目前仅 quiz 自动记录用时）" />
            ) : (
              <Scatter points={scatter} />
            )}
          </section>

          {/* Quiz: 答题正误热图 */}
          {taskType === "quiz" && (
            <section className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
              <header className="mb-3">
                <h2 className="text-sm font-semibold text-ink">答题正误热图</h2>
                <p className="mt-0.5 text-[11px] text-ink-5">
                  行 = 学生 · 列 = 题号 · 绿色正确 · 红色错误
                </p>
              </header>
              <QuizHeatmap rows={rows} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  tone: "brand" | "success" | "warn" | "ink";
}

function KpiCard({ label, value, hint, tone }: KpiCardProps) {
  const toneCls: Record<KpiCardProps["tone"], string> = {
    brand: "text-brand",
    success: "text-success",
    warn: "text-warn",
    ink: "text-ink",
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-5">
        {label}
      </div>
      <div
        className={`mt-1 text-[24px] font-bold tabular-nums tracking-[-0.02em] ${toneCls[tone]}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-ink-4">{hint}</div>
    </div>
  );
}

function Histogram({ buckets }: { buckets: HistogramBucket[] }) {
  const max = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);
  const W = 520;
  const H = 200;
  const PL = 36;
  const PR = 12;
  const PT = 16;
  const PB = 28;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const colW = innerW / buckets.length;

  // Color palette per bucket (cool → warm → cool)
  const colorClass = (i: number): string => {
    if (i === 0 || i === 1) return "fill-danger";
    if (i === 2) return "fill-warn";
    if (i === 3) return "fill-brand";
    return "fill-success";
  };

  const yTicks = max > 0 ? [0, Math.ceil(max / 2), max] : [0, 1, 2];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="分数分布直方图">
      {yTicks.map((t, i) => {
        const y = PT + (1 - t / Math.max(max, 1)) * innerH;
        return (
          <g key={i}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y}
              y2={y}
              className="stroke-line-2"
              strokeDasharray="3 3"
            />
            <text
              x={PL - 6}
              y={y + 3}
              fontSize="10"
              textAnchor="end"
              className="fill-ink-5"
            >
              {t}
            </text>
          </g>
        );
      })}
      {buckets.map((b, i) => {
        const safeCount = max > 0 ? b.count / max : 0;
        const barH = safeCount * innerH;
        const x = PL + i * colW + colW * 0.15;
        const y = PT + (1 - safeCount) * innerH;
        const w = colW * 0.7;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={w}
              height={barH}
              rx={3}
              className={`${colorClass(i)} opacity-90`}
            />
            <text
              x={x + w / 2}
              y={y - 4}
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
              className="fill-ink-3 tabular-nums"
            >
              {b.count > 0 ? b.count : ""}
            </text>
            <text
              x={PL + i * colW + colW / 2}
              y={H - PB + 14}
              fontSize="10"
              textAnchor="middle"
              className="fill-ink-5 tabular-nums"
            >
              {b.label}
            </text>
          </g>
        );
      })}
      <text
        x={W - PR}
        y={H - PB + 24}
        fontSize="10"
        textAnchor="end"
        className="fill-ink-5"
      >
        分数
      </text>
    </svg>
  );
}

function Scatter({ points }: { points: ScatterPoint[] }) {
  const W = 520;
  const H = 240;
  const PL = 40;
  const PR = 16;
  const PT = 16;
  const PB = 30;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const xs = points.map((p) => p.durationMinutes);
  const xMax = Math.max(30, Math.ceil(Math.max(...xs) / 5) * 5);
  const yMin = 0;
  const yMax = 100;

  const xPos = (m: number) => PL + (m / xMax) * innerW;
  const yPos = (s: number) =>
    PT + (1 - (s - yMin) / (yMax - yMin)) * innerH;

  // x ticks every 10 mins
  const xTicks: number[] = [];
  for (let i = 0; i <= xMax; i += Math.max(5, Math.floor(xMax / 6))) {
    xTicks.push(i);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="耗时与得分散点图">
      {/* y gridlines */}
      {[0, 25, 50, 75, 100].map((y) => (
        <g key={y}>
          <line
            x1={PL}
            x2={W - PR}
            y1={yPos(y)}
            y2={yPos(y)}
            className="stroke-line-2"
            strokeDasharray="3 3"
          />
          <text
            x={PL - 6}
            y={yPos(y) + 3}
            fontSize="10"
            textAnchor="end"
            className="fill-ink-5 tabular-nums"
          >
            {y}
          </text>
        </g>
      ))}
      {/* x ticks */}
      {xTicks.map((x) => (
        <text
          key={x}
          x={xPos(x)}
          y={H - PB + 14}
          fontSize="10"
          textAnchor="middle"
          className="fill-ink-5 tabular-nums"
        >
          {x}&apos;
        </text>
      ))}
      {/* axis label */}
      <text
        x={W - PR}
        y={H - PB + 26}
        fontSize="10"
        textAnchor="end"
        className="fill-ink-5"
      >
        用时（分钟）→
      </text>
      <text
        x={PL - 30}
        y={PT + 4}
        fontSize="10"
        className="fill-ink-5"
      >
        分数
      </text>
      {/* points */}
      {points.map((p) => (
        <circle
          key={p.submissionId}
          cx={xPos(p.durationMinutes)}
          cy={yPos(p.score)}
          r={5}
          className="fill-brand opacity-70 stroke-surface"
          strokeWidth={1.5}
        >
          <title>
            {p.studentName} · {p.durationMinutes} 分钟 · {p.score} 分
          </title>
        </circle>
      ))}
    </svg>
  );
}

interface QuizEvaluationLike {
  quizBreakdown?: Array<{
    questionId: string;
    correct?: boolean;
    score?: number;
    maxScore?: number;
  }>;
}

function QuizHeatmap({ rows }: { rows: NormalizedSubmission[] }) {
  // Build grid: rows = students, cols = questionIds (deterministic order)
  const data = useMemo(() => {
    const studentRows: Array<{
      studentName: string;
      cells: Array<{ questionId: string; correct: boolean | null }>;
    }> = [];
    const allQuestionIds = new Set<string>();

    for (const r of rows) {
      if (r.status !== "graded") continue;
      const ev = r.evaluation as unknown as QuizEvaluationLike | null;
      const breakdown = ev?.quizBreakdown ?? [];
      const cells = breakdown.map((b) => {
        allQuestionIds.add(b.questionId);
        const correct =
          typeof b.correct === "boolean"
            ? b.correct
            : typeof b.score === "number" && typeof b.maxScore === "number"
            ? b.score >= b.maxScore
            : null;
        return { questionId: b.questionId, correct };
      });
      studentRows.push({ studentName: r.studentName, cells });
    }
    const orderedIds = Array.from(allQuestionIds);
    return { studentRows, orderedIds };
  }, [rows]);

  if (data.studentRows.length === 0 || data.orderedIds.length === 0) {
    return (
      <EmptyChart label="暂无 quiz 提交可绘制热图" />
    );
  }

  const cellSize = 22;
  const gap = 2;
  const labelW = 96;
  const W = labelW + (cellSize + gap) * data.orderedIds.length + 12;
  const H = 28 + (cellSize + gap) * data.studentRows.length + 8;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ minWidth: W, height: H }}
        aria-label="答题正误热图"
      >
        {/* column headers (Q1, Q2, ...) */}
        {data.orderedIds.map((_, ci) => (
          <text
            key={ci}
            x={labelW + ci * (cellSize + gap) + cellSize / 2}
            y={20}
            fontSize="10"
            textAnchor="middle"
            className="fill-ink-5 tabular-nums"
          >
            Q{ci + 1}
          </text>
        ))}
        {/* rows */}
        {data.studentRows.map((srow, ri) => {
          const y = 28 + ri * (cellSize + gap);
          const cellByQ = new Map<string, boolean | null>();
          for (const c of srow.cells) cellByQ.set(c.questionId, c.correct);

          return (
            <g key={ri}>
              <text
                x={labelW - 6}
                y={y + cellSize * 0.65}
                fontSize="11"
                textAnchor="end"
                className="fill-ink-3"
              >
                {truncate(srow.studentName, 7)}
              </text>
              {data.orderedIds.map((qid, ci) => {
                const correct = cellByQ.get(qid);
                const cls =
                  correct === true
                    ? "fill-success opacity-80"
                    : correct === false
                    ? "fill-danger opacity-70"
                    : "fill-line-2 opacity-60";
                return (
                  <rect
                    key={ci}
                    x={labelW + ci * (cellSize + gap)}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx={3}
                    className={cls}
                  >
                    <title>
                      {srow.studentName} · Q{ci + 1} ·{" "}
                      {correct === true
                        ? "正确"
                        : correct === false
                        ? "错误"
                        : "未答"}
                    </title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-md border border-dashed border-line text-[12px] text-ink-5">
      {label}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
