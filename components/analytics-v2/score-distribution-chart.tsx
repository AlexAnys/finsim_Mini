"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
const MODE_STORAGE_KEY = "insights:score-distribution-mode";
type BinCount = 5 | 10;
type ViewMode = "single" | "multi";

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
  onViewAll?: () => void;
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

function readStoredMode(): ViewMode {
  if (typeof window === "undefined") return "single";
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (raw === "single" || raw === "multi") return raw;
  } catch {
    // ignore
  }
  return "single";
}

export default function ScoreDistributionChart({
  distribution,
  onBinClick,
  onViewAll,
}: Props) {
  const [binCount, setBinCount] = useState<BinCount>(readStoredBinCount);
  const [mode, setMode] = useState<ViewMode>(readStoredMode);

  function persistBinCount(next: BinCount) {
    setBinCount(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }

  function persistMode(next: ViewMode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
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

  const allClasses = useMemo<{
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

  const visibleClasses = useMemo(() => {
    if (mode === "multi") return allClasses.classes;
    return allClasses.classes.slice(0, 1);
  }, [allClasses.classes, mode]);

  const chartData = useMemo(() => {
    if (!view) return [];
    return view.bins.map((bin) => {
      const row: Record<string, string | number> = { label: bin.label };
      if (mode === "single") {
        const total = bin.classes
          .filter((c) =>
            visibleClasses.length > 0 ? c.classId === visibleClasses[0].id : true,
          )
          .reduce((acc, b) => acc + b.students.length, 0);
        row["__single__"] = total;
      } else {
        for (const c of visibleClasses) {
          const bucket = bin.classes.find((b) => b.classId === c.id);
          row[c.id] = bucket ? bucket.students.length : 0;
        }
      }
      return row;
    });
  }, [view, visibleClasses, mode]);

  const totalStudents = view?.totalStudents ?? 0;
  const scopeLabel = view?.scope === "single_task" ? "单任务" : "多任务";
  const isClickable = Boolean(onBinClick);

  const singleConfig: ChartConfig = useMemo(() => {
    return {
      __single__: {
        label: visibleClasses[0]?.label ?? "学生",
        color: "var(--color-brand)",
      },
    };
  }, [visibleClasses]);

  const handleClick = (data: unknown) => {
    if (!view || !onBinClick) return;
    const payload = data as { activeLabel?: string; activePayload?: Array<{ dataKey?: string; name?: string }> };
    const label = payload.activeLabel;
    if (!label) return;
    const bin = view.bins.find((b) => b.label === label);
    if (!bin) return;
    const item = payload.activePayload?.[0];
    let classId = (item?.dataKey ?? item?.name) as string | undefined;
    if (mode === "single") {
      classId = visibleClasses[0]?.id;
    }
    if (!classId) return;
    onBinClick(bin, classId);
  };

  return (
    <Card className="rounded-lg flex h-full flex-col gap-2 overflow-hidden py-3">
      <CardHeader className="space-y-0 pb-1 shrink-0 px-3 grid-cols-[1fr_auto] items-center gap-2 grid">
        <CardTitle className="text-sm font-medium truncate">
          学生成绩分布
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
            {totalStudents} 名学生 · {scopeLabel}
          </span>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Select
            value={String(binCount)}
            onValueChange={(v) => persistBinCount(Number(v) as BinCount)}
          >
            <SelectTrigger size="sm" className="h-7 w-[88px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 段</SelectItem>
              <SelectItem value="10">10 段</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            size="sm"
            value={mode}
            onValueChange={(v) => {
              if (v === "single" || v === "multi") persistMode(v);
            }}
          >
            <ToggleGroupItem value="single" aria-label="单班级" className="text-[11px] px-2">
              单班级
            </ToggleGroupItem>
            <ToggleGroupItem value="multi" aria-label="多班级对比" className="text-[11px] px-2">
              多班对比
            </ToggleGroupItem>
          </ToggleGroup>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              详情 <ArrowRight className="size-3" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 pb-1 px-3">
        {!view || allClasses.classes.length === 0 ? (
          <EmptyPanel icon={BarChart3} title="学生成绩分布 · 暂无数据" description="当前范围内尚无已批改的提交；请先批改若干提交或扩大筛选范围。" />
        ) : (
          <div
            role="img"
            aria-label="学生成绩分布柱状图，X 轴分数区间，Y 轴学生人数，按班级分组"
            className="h-full"
          >
            <ChartContainer
              config={mode === "single" ? singleConfig : allClasses.config}
              className="h-full w-full"
            >
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                onClick={isClickable ? handleClick : undefined}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  className="text-[10px]"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={24}
                  className="text-[10px]"
                />
                <ChartTooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `区间 ${String(label)}`}
                      formatter={(value, name) => {
                        const cfg =
                          mode === "single"
                            ? singleConfig[name as string]
                            : allClasses.config[name as string];
                        const display =
                          (cfg?.label as string | undefined) ?? String(name);
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
                {mode === "multi" && (
                  <Legend
                    content={(props) => (
                      <ChartLegendContent
                        payload={props.payload}
                        verticalAlign={props.verticalAlign}
                      />
                    )}
                  />
                )}
                {mode === "single" ? (
                  <Bar
                    key="__single__"
                    dataKey="__single__"
                    name={visibleClasses[0]?.label ?? "学生"}
                    fill="var(--color-brand)"
                    radius={[4, 4, 0, 0]}
                    style={isClickable ? { cursor: "pointer" } : undefined}
                  >
                    <LabelList
                      dataKey="__single__"
                      position="top"
                      className="fill-foreground text-[10px]"
                      formatter={(v) => { const n = Number(v); return n > 0 ? String(n) : ""; }}
                    />
                  </Bar>
                ) : (
                  visibleClasses.map((c) => (
                    <Bar
                      key={c.id}
                      dataKey={c.id}
                      name={c.label}
                      fill={`var(--color-${c.id})`}
                      radius={[4, 4, 0, 0]}
                      style={isClickable ? { cursor: "pointer" } : undefined}
                    >
                      <LabelList
                        dataKey={c.id}
                        position="top"
                        className="fill-foreground text-[10px]"
                        formatter={(v) => { const n = Number(v); return n > 0 ? String(n) : ""; }}
                      />
                    </Bar>
                  ))
                )}
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

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: import("lucide-react").LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-muted/50">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-xs font-medium">{title}</p>
      <p className="max-w-[240px] text-[11px] leading-4 text-muted-foreground">{description}</p>
    </div>
  );
}
