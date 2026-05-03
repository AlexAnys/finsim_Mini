"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Target,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  };
  chapterDiagnostics: ChapterDiagnostic[];
  studentInterventions: StudentInterventionLite[];
  dataQualityFlags?: QualityFlag[];
}

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  warning?: boolean;
  onClick?: () => void;
  href?: string;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  warning = false,
  onClick,
  href,
}: KpiCardProps) {
  const isInteractive = Boolean(onClick) || Boolean(href);
  const cardClassName = cn(
    "rounded-lg py-4",
    warning && "border-amber-200 bg-amber-50/40",
    isInteractive && "cursor-pointer transition-colors hover:bg-muted/40",
  );

  const inner = (
    <Card className={cardClassName}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            {warning && (
              <Badge
                variant="outline"
                className="rounded-md border-amber-300 bg-amber-50 text-amber-800"
              >
                需核对
              </Badge>
            )}
          </div>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-normal">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        {inner}
      </button>
    );
  }
  return inner;
}

export function KpiRow({ diagnosis }: { diagnosis: KpiRowDiagnosis }) {
  const { kpis, chapterDiagnostics, studentInterventions, dataQualityFlags } = diagnosis;

  const riskChapterCount = chapterDiagnostics.filter(
    (chapter) =>
      (chapter.completionRate !== null && chapter.completionRate < 0.6) ||
      (chapter.avgNormalizedScore !== null && chapter.avgNormalizedScore < 60),
  ).length;

  const riskStudentCount = new Set(studentInterventions.map((row) => row.studentId)).size;

  return (
    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        icon={CheckCircle2}
        label="完成率"
        value={formatRate(kpis.completionRate)}
        sub={`${kpis.submittedStudents}/${kpis.assignedStudents} 人次`}
        warning={hasQualityCategory(dataQualityFlags, ["assignment", "aggregation"])}
      />
      <KpiCard
        icon={Target}
        label="归一化均分"
        value={formatPercentNumber(kpis.avgNormalizedScore)}
        sub={`中位数 ${formatPercentNumber(kpis.medianNormalizedScore)}`}
        warning={hasQualityCategory(dataQualityFlags, ["score"])}
      />
      <KpiCard
        icon={Clock3}
        label="待发布"
        value={String(kpis.pendingReleaseCount)}
        sub="DDL 已到未发布"
      />
      <KpiCard
        icon={AlertCircle}
        label="风险章节"
        value={String(riskChapterCount)}
        sub={`${kpis.instanceCount} 个实例`}
      />
      <KpiCard
        icon={UserCog}
        label="风险学生"
        value={String(riskStudentCount)}
        sub="未交 / 低分 / 退步去重"
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

function hasQualityCategory(
  flags: QualityFlag[] | undefined,
  categories: QualityFlag["category"][],
) {
  if (!flags) return false;
  return flags.some((flag) => flag.severity !== "info" && categories.includes(flag.category));
}
