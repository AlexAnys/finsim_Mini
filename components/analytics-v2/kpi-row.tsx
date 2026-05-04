"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { isRiskChapter } from "@/lib/services/analytics-v2.service";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const Sparkline = dynamic(
  () => import("@/components/analytics-v2/sparkline").then((m) => m.Sparkline),
  { ssr: false, loading: () => null },
);

interface QualityFlag {
  severity: "info" | "warning" | "critical";
  category: "scope" | "assignment" | "score" | "attempt" | "sample" | "aggregation";
}

interface ChapterDiagnostic {
  completionRate: number | null;
  avgNormalizedScore: number | null;
}

interface StudentInterventionLite {
  studentId: string;
  reason: "not_submitted" | "low_score" | "declining";
}

interface WeeklyHistoryPoint {
  weekStart: string;
  completionRate: number | null;
  avgNormalizedScore: number | null;
}

export interface KpiRowDiagnosis {
  kpis: {
    submittedStudents: number;
    assignedStudents: number;
    submissionCount: number;
    instanceCount: number;
    completionRate: number | null;
    avgNormalizedScore: number | null;
    medianNormalizedScore: number | null;
    pendingReleaseCount: number;
    pendingReleaseTaskCount: number;
    weeklyHistory: WeeklyHistoryPoint[];
    previousWeekCompletionRate: number | null;
    previousWeekAvgScore: number | null;
  };
  chapterDiagnostics: ChapterDiagnostic[];
  studentInterventions: StudentInterventionLite[];
  dataQualityFlags?: QualityFlag[];
}

export type KpiKind =
  | "completion_rate"
  | "avg_score"
  | "pending_release"
  | "risk_signal";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  warning?: boolean;
  destructive?: boolean;
  delta?: React.ReactNode;
  sparkData?: Array<number | null>;
  sparkColor?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  warning = false,
  destructive = false,
  delta,
  sparkData,
  sparkColor,
  action,
  onClick,
}: KpiCardProps) {
  const isInteractive = Boolean(onClick);
  const cardClassName = cn(
    "rounded-lg py-2.5 transition-colors",
    warning && "border-amber-200 bg-amber-50/40",
    destructive && "border-destructive/30 bg-destructive/5",
    isInteractive && "cursor-pointer hover:bg-muted/40",
  );

  const inner = (
    <Card className={cardClassName}>
      <CardContent className="px-3 py-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            {warning && (
              <Badge
                variant="outline"
                className="rounded-md border-amber-300 bg-amber-50 text-[10px] text-amber-800"
              >
                需核对
              </Badge>
            )}
          </div>
          <Icon className={cn("size-4", destructive ? "text-destructive" : "text-muted-foreground")} />
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div className="text-xl font-semibold tracking-normal leading-tight">{value}</div>
          {sparkData && sparkData.length > 0 && (
            <Sparkline
              data={sparkData}
              color={sparkColor ?? "var(--color-brand)"}
              height={28}
              width={72}
            />
          )}
        </div>
        {(sub || delta || action) && (
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground line-clamp-1">{sub}</span>
            {delta && <span className="shrink-0">{delta}</span>}
            {action && <span className="shrink-0">{action}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg w-full"
      >
        {inner}
      </button>
    );
  }
  return inner;
}

interface KpiRowProps {
  diagnosis: KpiRowDiagnosis;
  onKpiClick?: (kind: KpiKind) => void;
}

export function KpiRow({ diagnosis, onKpiClick }: KpiRowProps) {
  const { kpis, chapterDiagnostics, studentInterventions, dataQualityFlags } = diagnosis;

  const riskChapterCount = chapterDiagnostics.filter(isRiskChapter).length;
  const riskStudentCount = new Set(studentInterventions.map((row) => row.studentId)).size;
  const isRiskActive = riskChapterCount > 0 || riskStudentCount > 0;

  const handle = (kind: KpiKind) => (onKpiClick ? () => onKpiClick(kind) : undefined);

  const completionSparkData = kpis.weeklyHistory.map((p) =>
    p.completionRate === null ? null : Math.round(p.completionRate * 100),
  );
  const scoreSparkData = kpis.weeklyHistory.map((p) => p.avgNormalizedScore);

  const completionDelta = formatPpDelta(
    kpis.completionRate,
    kpis.previousWeekCompletionRate,
  );
  const scoreDelta = formatScoreDelta(
    kpis.avgNormalizedScore,
    kpis.previousWeekAvgScore,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={CheckCircle2}
        label="完成率"
        value={formatRate(kpis.completionRate)}
        sub={`${kpis.submittedStudents}/${kpis.assignedStudents} 人次`}
        warning={hasQualityCategory(dataQualityFlags, ["assignment", "aggregation"])}
        sparkData={completionSparkData}
        sparkColor="var(--color-brand)"
        delta={completionDelta}
        onClick={handle("completion_rate")}
      />
      <KpiCard
        icon={Target}
        label="归一化均分"
        value={formatPercentNumber(kpis.avgNormalizedScore)}
        sub={`中位数 ${formatPercentNumber(kpis.medianNormalizedScore)}`}
        warning={hasQualityCategory(dataQualityFlags, ["score"])}
        sparkData={scoreSparkData}
        sparkColor="var(--color-success)"
        delta={scoreDelta}
        onClick={handle("avg_score")}
      />
      <KpiCard
        icon={Clock3}
        label="成绩待发布"
        value={`${kpis.pendingReleaseCount} 项`}
        sub={`涉及 ${kpis.pendingReleaseTaskCount} 个任务`}
        action={
          <Link
            href="/teacher/dashboard"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-xs text-brand hover:underline"
          >
            去发布 <ArrowRight className="size-3" />
          </Link>
        }
        onClick={handle("pending_release")}
      />
      <KpiCard
        icon={AlertTriangle}
        label="风险信号"
        value={`${riskChapterCount} 章节 | ${riskStudentCount} 学生`}
        sub="点击查看详情"
        destructive={isRiskActive}
        onClick={handle("risk_signal")}
      />
    </div>
  );
}

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatPercentNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "无";
  return `${Math.round(value * 10) / 10}%`;
}

function formatPpDelta(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const diff = (current - previous) * 100;
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) return <span className="text-muted-foreground">较上周 持平</span>;
  const positive = rounded > 0;
  return (
    <span className={cn("font-medium", positive ? "text-success" : "text-destructive")}>
      较上周 {positive ? "+" : ""}{rounded}pp {positive ? "↑" : "↓"}
    </span>
  );
}

function formatScoreDelta(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const diff = current - previous;
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) return <span className="text-muted-foreground">较上周 持平</span>;
  const positive = rounded > 0;
  return (
    <span className={cn("font-medium", positive ? "text-success" : "text-destructive")}>
      较上周 {positive ? "+" : ""}{rounded} 分 {positive ? "↑" : "↓"}
    </span>
  );
}

function hasQualityCategory(
  flags: QualityFlag[] | undefined,
  categories: QualityFlag["category"][],
) {
  if (!flags) return false;
  return flags.some((flag) => flag.severity !== "info" && categories.includes(flag.category));
}
