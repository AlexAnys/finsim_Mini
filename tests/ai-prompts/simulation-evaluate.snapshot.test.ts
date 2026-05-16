import { describe, it, expect } from "vitest";
import {
  buildSimulationEvaluatePrompt,
  buildEvidenceRetryHint,
  SIMULATION_EVALUATE_PROMPT_VERSION,
} from "@/lib/ai/prompts/simulation-evaluate";

const baseOpts = {
  taskName: "理财顾问咨询模拟",
  scenario: "客户希望规划教育金。",
  strictnessLevel: "MODERATE",
  rubric: [
    { id: "c1", name: "需求挖掘", description: "充分理解客户需求", maxPoints: 30 },
    { id: "c2", name: "方案合理性", description: "建议匹配客户风险偏好", maxPoints: 40 },
  ],
  transcriptText: "理财经理: 您好。\n客户: 我想准备教育金。",
  finalAllocations: "",
  snapshotsBlock: "",
};

describe("simulation-evaluate prompt builder (PR-1 E)", () => {
  it("default → systemPrompt snapshot", () => {
    const r = buildSimulationEvaluatePrompt(baseOpts);
    expect(r.systemPrompt).toMatchSnapshot();
  });

  it("default → userPrompt snapshot", () => {
    const r = buildSimulationEvaluatePrompt(baseOpts);
    expect(r.userPrompt).toMatchSnapshot();
  });

  it("with evaluatorPersona override", () => {
    const r = buildSimulationEvaluatePrompt({
      ...baseOpts,
      evaluatorPersona: "你是一位 20 年经验的金融教授。",
    });
    expect(r.systemPrompt.startsWith("你是一位 20 年经验的金融教授。")).toBe(true);
  });

  it("with finalAllocations + snapshotsBlock injected", () => {
    const r = buildSimulationEvaluatePrompt({
      ...baseOpts,
      finalAllocations: "最终资产配置方案（提交时刻）:\n{\"sections\":[]}\n\n",
      snapshotsBlock: "资产配置演变（共 1 次\"记录当前配比\"快照）:\n[第 1 轮 · 2026-05-16] 股票=50%\n\n",
    });
    expect(r.userPrompt).toContain("最终资产配置方案");
    expect(r.userPrompt).toContain("资产配置演变");
  });

  it("evidence retry hint mentions mismatchedCount", () => {
    expect(buildEvidenceRetryHint(3)).toContain("上一轮你引用的 3 条 studentText");
  });

  it("version is v1", () => {
    expect(SIMULATION_EVALUATE_PROMPT_VERSION).toBe("v1");
    expect(buildSimulationEvaluatePrompt(baseOpts).version).toBe("v1");
  });
});
