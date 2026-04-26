"use client";

import type { LucideIcon } from "lucide-react";
import {
  Users,
  FileCheck2,
  Clock,
  TrendingUp,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "brand" | "info" | "warn" | "success" | "danger";

const TONE_WRAP: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

const TONE_VALUE: Record<Tone, string> = {
  brand: "text-ink",
  info: "text-ink",
  warn: "text-warn",
  success: "text-ink",
  danger: "text-ink",
};

interface KpiCellProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone: Tone;
  delta?: string | null;
  trendUp?: boolean;
  urgent?: boolean;
}

function KpiCell({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  delta,
  trendUp,
  urgent,
}: KpiCellProps) {
  return (
    <Card className="py-0 gap-0">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11.5px] font-medium text-ink-4">{label}</div>
          <div
            className={cn(
              "grid size-6 place-items-center rounded-md",
              TONE_WRAP[tone],
            )}
          >
            <Icon className="size-[13px]" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div
            className={cn(
              "fs-num text-[26px] font-semibold tracking-[-0.03em]",
              urgent ? "text-warn" : TONE_VALUE[tone],
            )}
          >
            {value}
          </div>
          {delta && (
            <span className="fs-num text-[11px] font-semibold text-success">
              {delta}
            </span>
          )}
          {trendUp && (
            <TrendingUp className="size-[11px] text-success" />
          )}
        </div>
        {sub && <div className="mt-1 text-[11px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export interface KpiStripData {
  classCount: number;
  studentCount: number;
  submittedThisWeek: number;
  submittedDelta: number | null;
  completionRate: number | null;
  pendingCount: number;
  pendingHint: string | null;
  avgScore: number | null;
  avgScoreDelta: number | null;
  weakInstanceCount: number;
}

export function KpiStrip({ data }: { data: KpiStripData }) {
  const deltaLabel =
    data.submittedDelta != null && data.submittedDelta > 0
      ? `+${data.submittedDelta}`
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCell
        label="在教班级"
        value={data.classCount}
        sub={data.studentCount > 0 ? `共 ${data.studentCount} 名学生` : "—"}
        icon={Users}
        tone="brand"
      />
      <KpiCell
        label="本周提交"
        value={data.submittedThisWeek}
        sub={
          data.completionRate != null
            ? `完成率 ${data.completionRate}%`
            : "暂无提交"
        }
        icon={FileCheck2}
        tone="info"
        delta={deltaLabel}
      />
      <KpiCell
        label="需审核"
        value={data.pendingCount}
        sub={data.pendingHint ?? (data.pendingCount > 0 ? "按时间排序" : "暂无待审核")}
        icon={Clock}
        tone="warn"
        urgent={data.pendingCount > 0}
      />
      <KpiCell
        label="典型实例"
        value={data.weakInstanceCount}
        sub={
          data.weakInstanceCount > 0
            ? "低均分，建议讲解"
            : "无低分实例"
        }
        icon={Target}
        tone="danger"
      />
    </div>
  );
}
