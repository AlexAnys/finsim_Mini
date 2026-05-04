"use client";

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
import { Card } from "@/components/ui/card";
import { KpiTrailingVisual } from "@/components/analytics-v2/kpi-trailing-visual";
import { cn } from "@/lib/utils";

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
    previousWeekCompletionRate: number | null;
    previousWeekAvgScore: number | null;
    recentTasksTrend: RecentTaskTrendPoint[];
    pendingReleaseInstances: PendingReleaseInstance[];
    riskChapterSamples: RiskChapterSample[];
    riskStudentSamples: RiskStudentSample[];
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
  action?: React.ReactNode;
  trailing?: React.ReactNode;
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
  action,
  trailing,
  onClick,
}: KpiCardProps) {
  const isInteractive = Boolean(onClick);
  const cardClassName = cn(
    "rounded-lg flex flex-col items-stretch gap-2 min-h-[88px] py-2.5 px-3 transition-colors min-[1440px]:flex-row min-[1440px]:items-center min-[1440px]:gap-3",
    warning && "border-amber-200 bg-amber-50/40",
    destructive && "border-destructive/30 bg-destructive/5",
    isInteractive && "cursor-pointer hover:bg-muted/40",
  );

  const inner = (
    <Card className={cardClassName}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Icon
              className={cn(
                "size-3.5",
                destructive ? "text-destructive" : "text-muted-foreground",
              )}
            />
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
        </div>
        <div className="mt-0.5 text-lg font-semibold tracking-normal leading-tight lg:text-xl">
          {value}
        </div>
        {(sub || delta || action) && (
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground line-clamp-1">{sub}</span>
            {delta && <span className="shrink-0">{delta}</span>}
            {action && <span className="shrink-0">{action}</span>}
          </div>
        )}
      </div>
      {trailing && (
        <div className="hidden h-12 shrink-0 self-center min-[1440px]:block min-[1440px]:w-24">{trailing}</div>
      )}
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

  const completionDelta = formatPpDelta(
    kpis.completionRate,
    kpis.previousWeekCompletionRate,
  );
  const scoreDelta = formatScoreDelta(
    kpis.avgNormalizedScore,
    kpis.previousWeekAvgScore,
  );

  const showRiskTrailing =
    kpis.riskChapterSamples.length + kpis.riskStudentSamples.length > 0;
  const showPendingTrailing = kpis.pendingReleaseInstances.length > 0;

  return (
    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={CheckCircle2}
        label="完成率"
        value={formatRate(kpis.completionRate)}
        sub={`${kpis.submittedStudents}/${kpis.assignedStudents} 人次`}
        warning={hasQualityCategory(dataQualityFlags, ["assignment", "aggregation"])}
        delta={completionDelta}
        trailing={
          <KpiTrailingVisual kind="completion_rate" data={kpis.recentTasksTrend} />
        }
        onClick={handle("completion_rate")}
      />
      <KpiCard
        icon={Target}
        label="归一化均分"
        value={formatPercentNumber(kpis.avgNormalizedScore)}
        sub={`中位数 ${formatPercentNumber(kpis.medianNormalizedScore)}`}
        warning={hasQualityCategory(dataQualityFlags, ["score"])}
        delta={scoreDelta}
        trailing={
          <KpiTrailingVisual kind="avg_score" data={kpis.recentTasksTrend} />
        }
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
        trailing={
          showPendingTrailing ? (
            <KpiTrailingVisual
              kind="pending_release"
              data={kpis.pendingReleaseInstances}
            />
          ) : undefined
        }
        onClick={handle("pending_release")}
      />
      <KpiCard
        icon={AlertTriangle}
        label="风险信号"
        value={`${riskChapterCount} 章节 | ${riskStudentCount} 学生`}
        sub="点击查看详情"
        destructive={isRiskActive}
        trailing={
          showRiskTrailing ? (
            <KpiTrailingVisual
              kind="risk_signal"
              chapters={kpis.riskChapterSamples}
              students={kpis.riskStudentSamples}
            />
          ) : undefined
        }
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
