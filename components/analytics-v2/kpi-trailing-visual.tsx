"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Dot,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RecentTaskTrendPoint {
  taskInstanceId: string;
  title: string;
  completionRate: number | null;
  avgNormalizedScore: number | null;
  publishedAt: string;
}

interface PendingReleaseInstance {
  id: string;
  title: string;
  dueAt: string;
}

interface RiskChapterSample {
  chapterId: string;
  title: string;
}

interface RiskStudentSample {
  studentId: string;
  name: string;
  reason: "not_submitted" | "low_score" | "declining";
}

interface BaseProps {
  className?: string;
}

interface CompletionTrailingProps extends BaseProps {
  kind: "completion_rate";
  data: RecentTaskTrendPoint[];
}

interface AvgScoreTrailingProps extends BaseProps {
  kind: "avg_score";
  data: RecentTaskTrendPoint[];
}

interface PendingTrailingProps extends BaseProps {
  kind: "pending_release";
  data: PendingReleaseInstance[];
}

interface RiskTrailingProps extends BaseProps {
  kind: "risk_signal";
  chapters: RiskChapterSample[];
  students: RiskStudentSample[];
}

export type KpiTrailingVisualProps =
  | CompletionTrailingProps
  | AvgScoreTrailingProps
  | PendingTrailingProps
  | RiskTrailingProps;

export function KpiTrailingVisual(props: KpiTrailingVisualProps) {
  if (props.kind === "completion_rate") {
    return (
      <TrailingLineChart
        className={props.className}
        data={props.data}
        metric="rate"
      />
    );
  }
  if (props.kind === "avg_score") {
    return (
      <TrailingLineChart
        className={props.className}
        data={props.data}
        metric="percent"
      />
    );
  }
  if (props.kind === "pending_release") {
    return <TrailingPendingList className={props.className} items={props.data} />;
  }
  return (
    <TrailingRiskList
      className={props.className}
      chapters={props.chapters}
      students={props.students}
    />
  );
}

const InternalLineChart = dynamic(
  () =>
    Promise.resolve(function ChartImpl({
      data,
      metric,
    }: {
      data: RecentTaskTrendPoint[];
      metric: "rate" | "percent";
    }) {
      const chartData = useMemo(() => {
        const ascending = [...data].sort(
          (a, b) =>
            new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
        );
        return ascending
          .map((p, idx) => ({
            idx,
            title: p.title,
            value:
              metric === "rate"
                ? p.completionRate === null
                  ? null
                  : Math.round(p.completionRate * 1000) / 10
                : p.avgNormalizedScore,
          }))
          .filter((p) => p.value !== null);
      }, [data, metric]);
      const lastIdx = chartData.length - 1;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
          >
            <XAxis dataKey="idx" hide />
            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip
              cursor={false}
              contentStyle={{
                fontSize: 11,
                padding: "4px 8px",
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
              formatter={(value, _name, payload) => {
                const p = payload?.payload as { title?: string } | undefined;
                const display =
                  metric === "rate" ? `${value}%` : `${value} 分`;
                return [display, p?.title ?? "任务"];
              }}
              labelFormatter={() => ""}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-brand)"
              strokeWidth={1.5}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (
                  cx === undefined ||
                  cy === undefined ||
                  index !== lastIdx
                ) {
                  return (
                    <circle
                      key={`dot-${index}`}
                      cx={0}
                      cy={0}
                      r={0}
                      style={{ display: "none" }}
                    />
                  );
                }
                return (
                  <Dot
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={2.5}
                    fill="var(--color-brand)"
                  />
                );
              }}
              activeDot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }),
  { ssr: false, loading: () => null },
);

function TrailingLineChart({
  className,
  data,
  metric,
}: {
  className?: string;
  data: RecentTaskTrendPoint[];
  metric: "rate" | "percent";
}) {
  const validCount = data.filter((p) =>
    metric === "rate" ? p.completionRate !== null : p.avgNormalizedScore !== null,
  ).length;
  if (validCount < 2) {
    return (
      <div
        className={`flex h-full items-center justify-center text-[10px] text-muted-foreground ${className ?? ""}`}
        aria-label="过去任务趋势 · 暂无趋势"
      >
        暂无趋势
      </div>
    );
  }
  return (
    <div
      className={`h-full w-full ${className ?? ""}`}
      aria-label="过去任务趋势 mini chart"
    >
      <InternalLineChart data={data} metric={metric} />
    </div>
  );
}

function TrailingPendingList({
  className,
  items,
}: {
  className?: string;
  items: PendingReleaseInstance[];
}) {
  const [now] = useState<number>(() => Date.now());
  if (items.length === 0) return null;
  return (
    <ul
      className={`flex h-full w-full flex-col justify-center gap-0.5 ${className ?? ""}`}
      aria-label="待发布任务"
    >
      {items.slice(0, 3).map((item) => {
        const days = Math.max(
          0,
          Math.floor((now - new Date(item.dueAt).getTime()) / 86400000),
        );
        return (
          <li
            key={item.id}
            className="truncate text-[10px] leading-tight"
            title={`${item.title} · DDL 过 ${days} 天`}
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-muted-foreground"> 过 {days} 天</span>
          </li>
        );
      })}
    </ul>
  );
}

function TrailingRiskList({
  className,
  chapters,
  students,
}: {
  className?: string;
  chapters: RiskChapterSample[];
  students: RiskStudentSample[];
}) {
  const total = chapters.length + students.length;
  if (total === 0) return null;
  const visibleChapters = chapters.slice(0, 2);
  const visibleStudents = students.slice(0, 2);
  const visibleTotal = visibleChapters.length + visibleStudents.length;
  return (
    <ul
      className={`flex h-full w-full flex-col justify-center gap-0.5 ${className ?? ""}`}
      aria-label="风险样本"
    >
      {visibleChapters.map((c) => (
        <li
          key={`ch-${c.chapterId}`}
          className="truncate text-[10px] leading-tight"
          title={`章节 ${c.title}`}
        >
          📖 {c.title}
        </li>
      ))}
      {visibleStudents.map((s) => (
        <li
          key={`st-${s.studentId}`}
          className="truncate text-[10px] leading-tight"
          title={`学生 ${s.name}`}
        >
          👤 {s.name}
        </li>
      ))}
      {total > visibleTotal && (
        <li className="text-[10px] text-muted-foreground leading-tight">
          + 更多 {total - visibleTotal}
        </li>
      )}
    </ul>
  );
}
