// S1 (P1) 迟交扣分归因显示 — 纯 display helper（无副作用、可测、师/生共用）。
//
// 数据真源：grading.service.latePenaltyMetadata 在批改时写入
// evaluation.latePenalty = { applied, rate, originalScore, penaltyAmount, adjustedScore, label }。
// 总分按 score=原始分×(1-rate) 扣减（85→68），但 rubricBreakdown 各维度仍是扣分前原始分（和=85），
// 师/生结果视图只展示维度明细 → 看到「维度之和 ≠ 最终分」无解释。此 helper 把扣分明细归一供 UI 渲染。
//
// applied=false / 缺失 / 字段非法 → null（不渲染扣分行，无副作用）。

/** evaluation.latePenalty 的持久化形状（与 grading.service.latePenaltyMetadata 同步）。 */
export interface LatePenalty {
  applied: boolean;
  rate: number;
  originalScore: number;
  penaltyAmount: number;
  adjustedScore: number;
  label: string;
}

/** UI 直接渲染的扣分明细行：原始 X → 迟交扣分 −Y（Z%）→ 最终 W。 */
export interface LatePenaltyDisplay {
  originalScore: number;
  penaltyAmount: number;
  adjustedScore: number;
  rate: number;
  /** rate × 100 四舍五入，用于「迟交扣分 20%」百分比展示 */
  ratePercent: number;
  label: string;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * 从 evaluation 对象提取迟交扣分明细。
 * @returns applied=true 且字段齐全 → 明细；否则 null（无副作用）。
 */
export function buildLatePenaltyDisplay(
  evaluation: { latePenalty?: unknown } | null | undefined,
): LatePenaltyDisplay | null {
  if (!evaluation || typeof evaluation !== "object") return null;
  const penalty = (evaluation as { latePenalty?: unknown }).latePenalty;
  if (!penalty || typeof penalty !== "object") return null;

  const p = penalty as Record<string, unknown>;
  if (p.applied !== true) return null;
  if (
    !isFiniteNumber(p.originalScore) ||
    !isFiniteNumber(p.penaltyAmount) ||
    !isFiniteNumber(p.adjustedScore) ||
    !isFiniteNumber(p.rate)
  ) {
    return null;
  }

  return {
    originalScore: p.originalScore,
    penaltyAmount: p.penaltyAmount,
    adjustedScore: p.adjustedScore,
    rate: p.rate,
    ratePercent: Math.round(p.rate * 100),
    label: typeof p.label === "string" && p.label.length > 0 ? p.label : "迟交扣分",
  };
}
