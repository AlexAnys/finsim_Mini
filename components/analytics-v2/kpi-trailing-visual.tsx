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
        focus="completion"
      />
    );
  }
  if (props.kind === "avg_score") {
    return (
      <TrailingLineChart
        className={props.className}
        data={props.data}
        focus="score"
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
      focus,
    }: {
      data: RecentTaskTrendPoint[];
      focus: "completion" | "score";
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
            completion:
              p.completionRate === null
                ? null
                : Math.round(p.completionRate * 1000) / 10,
            score:
              p.avgNormalizedScore === null
                ? null
                : Math.round(p.avgNormalizedScore * 10) / 10,
          }))
          .filter((p) => p.completion !== null || p.score !== null);
      }, [data]);
      const primaryKey = focus === "completion" ? "completion" : "score";
      const secondaryKey = focus === "completion" ? "score" : "completion";
      const primaryName = focus === "completion" ? "完成率" : "均分";
      const secondaryName = focus === "completion" ? "均分" : "完成率";
      const lastPrimaryIdx = chartData.reduce((last, point, index) => {
        return point[primaryKey] === null ? last : index;
      }, -1);
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 4, bottom: 2 }}
          >
            <XAxis dataKey="idx" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              cursor={false}
              contentStyle={{
                fontSize: 11,
                padding: "4px 8px",
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
              formatter={(value, name, payload) => {
                const p = payload?.payload as { title?: string } | undefined;
                return [`${value}%`, `${p?.title ?? "任务"} · ${name}`];
              }}
              labelFormatter={() => ""}
            />
            <Line
              type="monotone"
              name={secondaryName}
              dataKey={secondaryKey}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.55}
              strokeWidth={1.2}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 2.5 }}
              connectNulls
            />
            <Line
              type="monotone"
              name={primaryName}
              dataKey={primaryKey}
              stroke="var(--color-brand)"
              strokeWidth={1.8}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (
                  cx === undefined ||
                  cy === undefined ||
                  index !== lastPrimaryIdx
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
  focus,
}: {
  className?: string;
  data: RecentTaskTrendPoint[];
  focus: "completion" | "score";
}) {
  const primaryCount = data.filter((p) =>
    focus === "completion" ? p.completionRate !== null : p.avgNormalizedScore !== null,
  ).length;
  const secondaryCount = data.filter((p) =>
    focus === "completion" ? p.avgNormalizedScore !== null : p.completionRate !== null,
  ).length;
  if (Math.max(primaryCount, secondaryCount) < 2) {
    return (
      <div
        className={`flex h-full items-center justify-center text-[10px] text-muted-foreground ${className ?? ""}`}
        aria-label="过去任务趋势 · 暂无趋势"
      >
        暂无趋势
      </div>
    );
  }
  const primaryLabel = focus === "completion" ? "完成" : "均分";
  const secondaryLabel = focus === "completion" ? "均分" : "完成";
  return (
    <div
      className={`flex h-full w-full min-w-0 flex-col ${className ?? ""}`}
      aria-label="最近十次任务双线趋势"
    >
      <div className="min-h-0 flex-1">
        <InternalLineChart data={data} focus={focus} />
      </div>
      <div className="flex h-3 items-center justify-end gap-2 text-[9px] leading-none text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
          {secondaryLabel}
        </span>
      </div>
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
  if (items.length === 0) {
    return (
      <div
        className={`flex h-full items-center justify-center rounded-md bg-muted/30 px-2 text-[10px] text-muted-foreground ${className ?? ""}`}
        aria-label="暂无待发布任务"
      >
        暂无待发布
      </div>
    );
  }
  return (
    <ul
      className={`flex h-full w-full flex-col justify-center gap-1 ${className ?? ""}`}
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
            className="truncate text-[11px] leading-tight"
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
  if (total === 0) {
    return (
      <div
        className={`flex h-full items-center justify-center rounded-md bg-muted/30 px-2 text-[10px] text-muted-foreground ${className ?? ""}`}
        aria-label="暂无风险样本"
      >
        暂无风险样本
      </div>
    );
  }
  const visibleChapters = chapters.slice(0, 2);
  const visibleStudents = students.slice(0, 2);
  const visibleTotal = visibleChapters.length + visibleStudents.length;
  return (
    <ul
      className={`flex h-full w-full flex-col justify-center gap-1 ${className ?? ""}`}
      aria-label="风险样本"
    >
      {visibleChapters.map((c) => (
        <li
          key={`ch-${c.chapterId}`}
          className="truncate text-[11px] leading-tight"
          title={`章节 ${c.title}`}
        >
          <span className="mr-1 rounded bg-destructive/10 px-1 text-[9px] text-destructive">章</span>
          {c.title}
        </li>
      ))}
      {visibleStudents.map((s) => (
        <li
          key={`st-${s.studentId}`}
          className="truncate text-[11px] leading-tight"
          title={`学生 ${s.name}`}
        >
          <span className="mr-1 rounded bg-amber-100 px-1 text-[9px] text-amber-800">生</span>
          {s.name}
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
