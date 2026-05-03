"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface ScoreDistributionStudent {
  id: string;
  name: string;
  score: number;
  taskInstanceId?: string;
}

export interface ScoreDistributionClassBucket {
  classId: string;
  classLabel: string;
  students: ScoreDistributionStudent[];
}

export interface ScoreDistributionBin {
  label: string;
  min: number;
  max: number;
  classes: ScoreDistributionClassBucket[];
}

export interface ScoreDistribution {
  bins: ScoreDistributionBin[];
  binCount: number;
  scope: "single_task" | "multi_task";
  totalStudents: number;
}

const STORAGE_KEY = "insights:score-distribution-bins";
type BinCount = 5 | 10;

const CLASS_COLOR_VARS = [
  "var(--color-brand)",
  "var(--color-ochre)",
  "var(--color-success)",
  "var(--color-sim)",
  "var(--color-brand-violet)",
] as const;

interface Props {
  distribution: ScoreDistribution | null | undefined;
  onBinClick?: (bin: ScoreDistributionBin, classId: string) => void;
}

function readStoredBinCount(): BinCount {
  if (typeof window === "undefined") return 5;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (parsed === 5 || parsed === 10) return parsed;
  } catch {
    // ignore
  }
  return 5;
}

export default function ScoreDistributionChart({ distribution, onBinClick }: Props) {
  const [binCount, setBinCount] = useState<BinCount>(readStoredBinCount);

  function persistBinCount(next: BinCount) {
    setBinCount(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }

  const incoming = distribution ?? null;
  const matchesPreference = incoming?.binCount === binCount;
  const view: ScoreDistribution | null = useMemo(() => {
    if (!incoming) return null;
    if (matchesPreference) return incoming;
    return rebinDistribution(incoming, binCount);
  }, [incoming, binCount, matchesPreference]);

  const classConfig = useMemo<{
    classes: Array<{ id: string; label: string; color: string }>;
    config: ChartConfig;
  }>(() => {
    if (!view) return { classes: [], config: {} };
    const map = new Map<string, string>();
    for (const bin of view.bins) {
      for (const bucket of bin.classes) {
        if (!map.has(bucket.classId)) {
          map.set(bucket.classId, bucket.classLabel);
        }
      }
    }
    const classes = Array.from(map.entries()).map(([id, label], index) => ({
      id,
      label,
      color: CLASS_COLOR_VARS[index % CLASS_COLOR_VARS.length],
    }));
    const config: ChartConfig = {};
    for (const c of classes) {
      config[c.id] = { label: c.label, color: c.color };
    }
    return { classes, config };
  }, [view]);

  const chartData = useMemo(() => {
    if (!view) return [];
    return view.bins.map((bin) => {
      const row: Record<string, string | number> = { label: bin.label };
      for (const c of classConfig.classes) {
        const bucket = bin.classes.find((b) => b.classId === c.id);
        row[c.id] = bucket ? bucket.students.length : 0;
      }
      return row;
    });
  }, [view, classConfig.classes]);

  const totalStudents = view?.totalStudents ?? 0;
  const scopeLabel = view?.scope === "single_task" ? "单任务" : "多任务";
  const isClickable = Boolean(onBinClick);

  const handleClick = (data: unknown) => {
    if (!view || !onBinClick) return;
    const payload = data as { activeLabel?: string; activePayload?: Array<{ dataKey?: string; name?: string }> };
    const label = payload.activeLabel;
    if (!label) return;
    const bin = view.bins.find((b) => b.label === label);
    if (!bin) return;
    const item = payload.activePayload?.[0];
    const classId = (item?.dataKey ?? item?.name) as string | undefined;
    if (!classId) return;
    onBinClick(bin, classId);
  };

  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">学生成绩分布</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            按归一化分数 (0-100) 分组｜{totalStudents} 名学生｜{scopeLabel}
            {view?.scope === "multi_task"
              ? "（按学生在范围内均分聚合）"
              : "（当前任务每位学生归一化分数）"}
          </p>
        </div>
        <Select
          value={String(binCount)}
          onValueChange={(v) => persistBinCount(Number(v) as BinCount)}
        >
          <SelectTrigger size="sm" className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5 段区间</SelectItem>
            <SelectItem value="10">10 段区间</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!view || classConfig.classes.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            当前范围暂无已批改 submission
          </div>
        ) : (
          <div
            role="img"
            aria-label="学生成绩分布柱状图，X 轴分数区间，Y 轴学生人数，按班级分组"
          >
            <ChartContainer config={classConfig.config} className="h-[280px] w-full">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                onClick={isClickable ? handleClick : undefined}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                />
                <ChartTooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `区间 ${String(label)}`}
                      formatter={(value, name) => {
                        const cfg = classConfig.config[name as string];
                        const display = (cfg?.label as string | undefined) ?? String(name);
                        return (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">{display}</span>
                            <span className="font-mono font-medium tabular-nums">
                              {Number(value)} 人
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Legend
                  content={(props) => (
                    <ChartLegendContent
                      payload={props.payload}
                      verticalAlign={props.verticalAlign}
                    />
                  )}
                />
                {classConfig.classes.map((c) => (
                  <Bar
                    key={c.id}
                    dataKey={c.id}
                    name={c.label}
                    fill={`var(--color-${c.id})`}
                    radius={[4, 4, 0, 0]}
                    style={isClickable ? { cursor: "pointer" } : undefined}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function rebinDistribution(source: ScoreDistribution, binCount: number): ScoreDistribution {
  const bucketSize = 100 / binCount;
  const bins: ScoreDistributionBin[] = Array.from({ length: binCount }, (_, index) => {
    const min = Math.round(index * bucketSize * 10) / 10;
    const max = Math.round((index + 1) * bucketSize * 10) / 10;
    return { label: `${min}-${max}`, min, max, classes: [] };
  });

  type Entry = ScoreDistributionStudent & { classId: string; classLabel: string };
  const entries: Entry[] = [];
  for (const bin of source.bins) {
    for (const bucket of bin.classes) {
      for (const student of bucket.students) {
        entries.push({
          ...student,
          classId: bucket.classId,
          classLabel: bucket.classLabel,
        });
      }
    }
  }

  for (const entry of entries) {
    const clamped = Math.max(0, Math.min(100, entry.score));
    const binIndex = Math.min(binCount - 1, Math.floor(clamped / bucketSize));
    const bin = bins[binIndex];
    let bucket = bin.classes.find((c) => c.classId === entry.classId);
    if (!bucket) {
      bucket = { classId: entry.classId, classLabel: entry.classLabel, students: [] };
      bin.classes.push(bucket);
    }
    bucket.students.push({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      ...(entry.taskInstanceId ? { taskInstanceId: entry.taskInstanceId } : {}),
    });
  }

  for (const bin of bins) {
    for (const bucket of bin.classes) {
      bucket.students.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-CN"));
    }
    bin.classes.sort((a, b) => a.classLabel.localeCompare(b.classLabel, "zh-CN"));
  }

  return {
    bins,
    binCount,
    scope: source.scope,
    totalStudents: source.totalStudents,
  };
}
