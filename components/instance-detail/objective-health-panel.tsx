"use client";

// S4a 班级「客观体检」面板 — 教师向，simulation-only。
// 客观信号（行为/产出）与 AI 主观评分分开呈现，让老师对照核验 AI 判分是否合理。
// 数据由 getInstanceObjectiveStats（service 层）算好，本组件纯渲染 props。
// ⚠️ 维度短板用「扣分前原始分」，basisLabel 显著呈现、与扣分后总均分区分（S1 pin）。

import { Activity, BarChart3, MessagesSquare, PieChart, Tag, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DimensionShortfall {
  criterionId: string;
  criterionName: string;
  avgScore: number;
  avgMaxScore: number;
  scoreRate: number;
  sampleSize: number;
}
interface ConceptHeatItem {
  canonical: string;
  count: number;
  coverage: number;
}
interface StudentEngagement {
  studentId: string;
  studentName: string;
  studentTurns: number;
  studentCharTotal: number;
  studentCharAvg: number;
}

export interface ObjectiveStats {
  isSimulation: boolean;
  gradedCount: number;
  dimensionShortfall: {
    dimensions: DimensionShortfall[];
    scoreBasis: "raw_pre_penalty";
    basisLabel: string;
  };
  conceptHeatmap: {
    studentCount: number;
    concepts: ConceptHeatItem[];
  };
  engagement: {
    perStudent: StudentEngagement[];
    classSummary: {
      studentCount: number;
      avgTurns: number;
      minTurns: number;
      maxTurns: number;
      avgCharTotal: number;
    };
  };
  allocationDistribution: {
    withProfileCount: number;
    avgEquityPercent: number;
    avgLowRiskPercent: number;
    avgOtherPercent: number;
    completeCount: number;
  };
}

function rateColor(rate: number): string {
  if (rate >= 70) return "bg-green-500";
  if (rate >= 50) return "bg-orange-500";
  return "bg-red-500";
}

export function ObjectiveHealthPanel({ stats }: { stats: ObjectiveStats }) {
  // simulation-only 门控：非 sim 任务不渲染该面板
  if (!stats.isSimulation) return null;

  const { dimensionShortfall, conceptHeatmap, engagement, allocationDistribution } = stats;
  const hasData = stats.gradedCount > 0;

  return (
    <Card className="border-sim/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-sim" />
          客观体检
          <Badge variant="outline" className="ml-1 text-[10px] font-normal text-muted-foreground">
            行为/产出信号 · 与 AI 评分对照
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">暂无已批改提交，客观体检数据待批改后生成。</p>
        ) : (
          <>
            {/* 维度短板（扣分前原始分） */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <TrendingDown className="size-3.5 text-muted-foreground" />
                维度短板排名
              </div>
              {/* S1 pin：基准口径显著标注，与扣分后总均分区分 */}
              <div className="mb-2.5 rounded-md border border-warn/30 bg-warn-soft/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-3">
                {dimensionShortfall.basisLabel}
              </div>
              {dimensionShortfall.dimensions.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无维度评分数据。</p>
              ) : (
                <div className="space-y-2">
                  {dimensionShortfall.dimensions.map((d) => (
                    <div key={d.criterionId} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate text-xs text-ink-2" title={d.criterionName}>
                        {d.criterionName}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className={`h-full rounded ${rateColor(d.scoreRate)}`}
                          style={{ width: `${Math.min(d.scoreRate, 100)}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {d.avgScore}/{d.avgMaxScore}（{d.scoreRate}%）
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 参与度分布 */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <MessagesSquare className="size-3.5 text-muted-foreground" />
                对话参与度
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <div className="text-[10.5px] text-muted-foreground">平均轮次</div>
                  <div className="text-lg font-semibold tabular-nums">{engagement.classSummary.avgTurns}</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-[10.5px] text-muted-foreground">轮次范围</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {engagement.classSummary.minTurns}–{engagement.classSummary.maxTurns}
                  </div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-[10.5px] text-muted-foreground">平均发言字数</div>
                  <div className="text-lg font-semibold tabular-nums">{engagement.classSummary.avgCharTotal}</div>
                </div>
              </div>
            </section>

            {/* 资产配置分布 */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <PieChart className="size-3.5 text-muted-foreground" />
                资产配置画像（班级均值）
              </div>
              {allocationDistribution.withProfileCount === 0 ? (
                <p className="text-xs text-muted-foreground">暂无配置数据。</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border p-2">
                      <div className="text-[10.5px] text-muted-foreground">权益敞口</div>
                      <div className="text-lg font-semibold tabular-nums text-orange-600">
                        {allocationDistribution.avgEquityPercent}%
                      </div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-[10.5px] text-muted-foreground">低风险占比</div>
                      <div className="text-lg font-semibold tabular-nums text-green-600">
                        {allocationDistribution.avgLowRiskPercent}%
                      </div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-[10.5px] text-muted-foreground">其它/未分类</div>
                      <div className="text-lg font-semibold tabular-nums text-muted-foreground">
                        {allocationDistribution.avgOtherPercent}%
                      </div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {allocationDistribution.completeCount}/{allocationDistribution.withProfileCount} 人配置合计为
                    100%（其余存在合计偏差，需留意数据质量）。
                  </p>
                </>
              )}
            </section>

            {/* 概念覆盖热力 */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Tag className="size-3.5 text-muted-foreground" />
                概念覆盖热力
                <span className="text-[10.5px] font-normal text-muted-foreground">（同义已归并）</span>
              </div>
              {conceptHeatmap.concepts.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无概念标签。</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {conceptHeatmap.concepts.map((c) => (
                    <span
                      key={c.canonical}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px]"
                      title={`${c.count}/${conceptHeatmap.studentCount} 人 · 覆盖率 ${c.coverage}%`}
                    >
                      <BarChart3 className="size-3 text-muted-foreground" />
                      {c.canonical}
                      <b className="tabular-nums text-ink-2">{c.count}</b>
                    </span>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
