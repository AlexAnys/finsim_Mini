"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { TaskPerformanceBlock } from "@/components/analytics-v2/task-performance-block";
import { StudyBuddyBlock } from "@/components/analytics-v2/study-buddy-block";
import { TeachingAdviceBlock } from "@/components/analytics-v2/teaching-advice-block";
import {
  EvidenceDrawer,
  type EvidenceItem,
} from "@/components/analytics-v2/evidence-drawer";
import type {
  ScoreDistribution,
  ScoreDistributionBin,
} from "@/components/analytics-v2/score-distribution-chart";
import type {
  ScopeSimulationInsight,
  ScopeStudyBuddySummary,
} from "@/lib/services/scope-insights.service";

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
  scopeInsights?: {
    simulation: ScopeSimulationInsight | null;
    studyBuddy: ScopeStudyBuddySummary | null;
  };
  scopeInsightsLoading?: boolean;
  scopeInsightsRefreshing?: boolean;
  onRefreshScopeInsights?: () => void;
  onBinClick?: (bin: ScoreDistributionBin, classId: string) => void;
}

export function InsightsGrid({
  diagnosis,
  scopeInsights,
  scopeInsightsLoading,
  scopeInsightsRefreshing,
  onRefreshScopeInsights,
  onBinClick,
}: InsightsGridProps) {
  const safeScopeInsights = scopeInsights ?? { simulation: null, studyBuddy: null };
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function openEvidence(item: EvidenceItem) {
    setEvidence(item);
    setDrawerOpen(true);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScoreDistributionChart
          distribution={diagnosis.scoreDistribution}
          onBinClick={onBinClick}
        />
        <TaskPerformanceBlock
          data={safeScopeInsights.simulation}
          loading={scopeInsightsLoading && !safeScopeInsights.simulation}
          refreshing={scopeInsightsRefreshing}
          onRefresh={onRefreshScopeInsights}
          onOpenEvidence={openEvidence}
        />
        <StudyBuddyBlock
          data={safeScopeInsights.studyBuddy}
          loading={scopeInsightsLoading && !safeScopeInsights.studyBuddy}
          onOpenEvidence={openEvidence}
        />
        <TeachingAdviceBlock />
      </div>
      <EvidenceDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setTimeout(() => setEvidence(null), 200);
          }
        }}
        evidence={evidence}
      />
    </>
  );
}
