import { describe, it, expect } from "vitest";
import { buildLatePenaltyDisplay } from "@/lib/utils/late-penalty";

/**
 * S1 (P1) 迟交扣分归因显示 — 纯 display helper 单测。
 *
 * 根因：批改时 20% 迟交扣分只作用于总分（85→68），
 * 但 evaluation.rubricBreakdown 各维度仍是扣分前原始分（和=85），
 * 师/生结果视图只展示维度明细 → 用户看到「维度之和 85 ≠ 最终分 68」却无解释。
 *
 * buildLatePenaltyDisplay 把 evaluation.latePenalty（grading.service 已写入）
 * 归一成 UI 可直接渲染的明细行；applied=false / 缺失 → null（无副作用，不渲染扣分行）。
 */
describe("buildLatePenaltyDisplay", () => {
  it("applied=true: 返回扣分明细（原始/扣分额/最终/百分比）", () => {
    const result = buildLatePenaltyDisplay({
      latePenalty: {
        applied: true,
        rate: 0.2,
        originalScore: 85,
        penaltyAmount: 17,
        adjustedScore: 68,
        label: "迟交扣分 20%",
      },
    });

    expect(result).not.toBeNull();
    expect(result!.originalScore).toBe(85);
    expect(result!.penaltyAmount).toBe(17);
    expect(result!.adjustedScore).toBe(68);
    expect(result!.ratePercent).toBe(20);
    expect(result!.label).toBe("迟交扣分 20%");
  });

  it("applied=false: 返回 null（不渲染扣分行，无副作用）", () => {
    const result = buildLatePenaltyDisplay({
      latePenalty: {
        applied: false,
        rate: 0.2,
        originalScore: 90,
        penaltyAmount: 0,
        adjustedScore: 90,
        label: "迟交扣分 20%",
      },
    });

    expect(result).toBeNull();
  });

  it("evaluation 缺失 latePenalty（历史评分）: 返回 null", () => {
    expect(buildLatePenaltyDisplay({})).toBeNull();
    expect(buildLatePenaltyDisplay(null)).toBeNull();
    expect(buildLatePenaltyDisplay(undefined)).toBeNull();
  });

  it("latePenalty 字段非法（schema 漂移）: 返回 null 而非抛错", () => {
    expect(
      buildLatePenaltyDisplay({ latePenalty: { applied: true } as unknown as never }),
    ).toBeNull();
    expect(
      buildLatePenaltyDisplay({ latePenalty: "迟交" as unknown as never }),
    ).toBeNull();
  });

  it("ratePercent 由 rate 派生且四舍五入（0.2→20, 0.15→15）", () => {
    const r1 = buildLatePenaltyDisplay({
      latePenalty: { applied: true, rate: 0.15, originalScore: 80, penaltyAmount: 12, adjustedScore: 68, label: "迟交扣分 15%" },
    });
    expect(r1!.ratePercent).toBe(15);
  });
});
