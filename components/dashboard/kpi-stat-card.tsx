"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiAccent = "brand" | "ochre" | "success" | "sim";

const ACCENT_WRAP: Record<KpiAccent, string> = {
  brand: "bg-brand-soft text-brand",
  ochre: "bg-ochre-soft text-ochre",
  success: "bg-success-soft text-success",
  sim: "bg-sim-soft text-sim",
};

interface KpiStatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: KpiAccent;
  trendUp?: boolean;
}

export function KpiStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "brand",
  trendUp,
}: KpiStatCardProps) {
  return (
    <Card className="py-0 gap-0">
      <CardContent className="p-[18px]">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-xs font-medium text-ink-4">{label}</div>
          <div
            className={cn(
              "grid size-[26px] place-items-center rounded-md",
              ACCENT_WRAP[accent],
            )}
          >
            <Icon className="size-[13px]" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div className="fs-num text-[28px] font-semibold tracking-[-0.03em] text-ink">
            {value}
          </div>
          {trendUp && (
            <span className="text-[11px] font-semibold text-success">↑</span>
          )}
        </div>
        {sub && <div className="mt-1 text-[11.5px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}
