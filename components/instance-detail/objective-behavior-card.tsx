"use client";

// S4b 个体「客观行为卡」— 教师批改单份 simulation 提交时，与 AI 评分**并列**展示客观信号
// （轮次·字数 / 资产配置 / 概念标签 / 迟交扣分），让老师对照核验 AI 判分是否合理
// （如：发言充分 + 配置合理但 AI 给分低 → 提示复核）。
// 纯 props 渲染 + 调 S3/S1 纯 utils（client-side，无新 endpoint、0 schema）。

import { Activity, MessagesSquare, PieChart, Tag, TimerOff } from "lucide-react";
import { computeTranscriptStats } from "@/lib/utils/transcript-stats";
import { buildAllocationProfile, canonicalizeConceptTag } from "@/lib/utils/sim-objective-stats";
import { buildLatePenaltyDisplay } from "@/lib/utils/late-penalty";

interface ObjectiveBehaviorCardProps {
  transcript: unknown;
  assets: unknown;
  conceptTags?: string[] | null;
  // 复用 S1 latePenalty 展示（applied=false / 缺失 → 不显示扣分行）；
  // 形状对齐 buildLatePenaltyDisplay 入参（只读 .latePenalty）。
  evaluation: { latePenalty?: unknown } | null | undefined;
}

export function ObjectiveBehaviorCard({
  transcript,
  assets,
  conceptTags,
  evaluation,
}: ObjectiveBehaviorCardProps) {
  const engagement = computeTranscriptStats(transcript);
  const allocation = buildAllocationProfile(assets);
  const latePenalty = buildLatePenaltyDisplay(evaluation);
  // 概念标签去重归并（同一份提交内同义碎片合一）
  const concepts = Array.from(
    new Set(
      (Array.isArray(conceptTags) ? conceptTags : [])
        .filter((t): t is string => typeof t === "string")
        .map(canonicalizeConceptTag)
        .filter(Boolean),
    ),
  );

  return (
    <div className="rounded-lg border border-line bg-paper-alt/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
        <Activity className="size-3.5 text-ink-4" aria-hidden="true" />
        客观行为
        <span className="text-[10px] font-normal text-ink-5">（与 AI 评分对照核验）</span>
      </div>

      {/* 参与度：轮次 + 字数 */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
        <span className="inline-flex items-center gap-1">
          <MessagesSquare className="size-3 text-ink-5" aria-hidden="true" />
          对话轮次 <b className="tabular-nums text-ink-2">{engagement.studentTurns}</b>
        </span>
        <span className="inline-flex items-center gap-1">
          发言字数 <b className="tabular-nums text-ink-2">{engagement.studentCharTotal}</b>
          <span className="text-ink-5">（均 {engagement.studentCharAvg}/轮）</span>
        </span>
      </div>

      {/* 资产配置画像 */}
      {allocation && (
        <div className="mb-2 text-[11.5px] text-ink-3">
          <div className="mb-0.5 inline-flex items-center gap-1 font-medium text-ink-2">
            <PieChart className="size-3 text-ink-5" aria-hidden="true" />
            资产配置
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums">
            <span className="text-orange-600">权益 {allocation.equityPercent}%</span>
            <span className="text-green-600">低风险 {allocation.lowRiskPercent}%</span>
            {allocation.otherPercent > 0 && (
              <span className="text-ink-5">其它 {allocation.otherPercent}%</span>
            )}
            <span className={allocation.isComplete ? "text-ink-5" : "text-warn"}>
              合计 {allocation.totalPercent}%{allocation.isComplete ? "" : "（≠100，需留意）"}
            </span>
          </div>
        </div>
      )}

      {/* 概念标签 */}
      {concepts.length > 0 && (
        <div className="mb-2 text-[11.5px]">
          <div className="mb-0.5 inline-flex items-center gap-1 font-medium text-ink-2">
            <Tag className="size-3 text-ink-5" aria-hidden="true" />
            概念标签
          </div>
          <div className="flex flex-wrap gap-1">
            {concepts.map((c) => (
              <span
                key={c}
                className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-[10.5px] text-ink-3"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 迟交扣分（复用 S1） */}
      {latePenalty && (
        <div className="rounded-md border border-warn/30 bg-warn-soft/50 px-2 py-1.5 text-[11px] text-ink-3">
          <div className="mb-0.5 inline-flex items-center gap-1 font-semibold text-warn">
            <TimerOff className="size-3" aria-hidden="true" />
            {latePenalty.label}
          </div>
          <div className="flex flex-wrap items-center gap-x-1 tabular-nums">
            <span>原始 <b className="text-ink-2">{latePenalty.originalScore}</b></span>
            <span className="text-ink-5">→</span>
            <span className="text-danger">−{latePenalty.penaltyAmount}（{latePenalty.ratePercent}%）</span>
            <span className="text-ink-5">→</span>
            <span>最终 <b className="text-ink-2">{latePenalty.adjustedScore}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}
