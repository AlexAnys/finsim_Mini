"use client";

import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

interface SparklineProps {
  data: Array<number | null>;
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({
  data,
  color = "var(--color-brand)",
  height = 32,
  width = 80,
}: SparklineProps) {
  const chartData = useMemo(
    () =>
      data.map((value, idx) => ({
        idx,
        value: value ?? null,
      })),
    [data],
  );
  const hasData = data.some((v) => v !== null);
  if (!hasData) {
    return (
      <div
        className="text-[10px] text-muted-foreground"
        style={{ height, width }}
      >
        —
      </div>
    );
  }
  return (
    <div style={{ height, width }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
