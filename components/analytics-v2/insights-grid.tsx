"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { TaskPerformanceBlock } from "@/components/analytics-v2/task-performance-block";
import { StudyBuddyBlock } from "@/components/analytics-v2/study-buddy-block";
import { TeachingAdviceBlock } from "@/components/analytics-v2/teaching-advice-block";
import type { ScoreDistribution, ScoreDistributionBin } from "@/components/analytics-v2/score-distribution-chart";

const ScoreDistributionChart = dynamic(
  () => import("@/components/analytics-v2/score-distribution-chart"),
  {
    ssr: false,
    loading: () => (
      <Card className="rounded-lg">
        <CardContent className="flex h-[280px] items-center justify-center px-4 py-8 text-sm text-muted-foreground">
          正在加载图表
        </CardContent>
      </Card>
    ),
  },
);

interface InsightsGridDiagnosis {
  scoreDistribution: ScoreDistribution;
}

interface InsightsGridProps {
  diagnosis: InsightsGridDiagnosis;
  onBinClick?: (bin: ScoreDistributionBin, classId: string) => void;
}

export function InsightsGrid({ diagnosis, onBinClick }: InsightsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ScoreDistributionChart
        distribution={diagnosis.scoreDistribution}
        onBinClick={onBinClick}
      />
      <TaskPerformanceBlock />
      <StudyBuddyBlock />
      <TeachingAdviceBlock />
    </div>
  );
}
