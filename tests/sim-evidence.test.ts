import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiRun: { create: vi.fn(), update: vi.fn() },
    aiToolSetting: { findUnique: vi.fn() },
  },
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({ chat: vi.fn(() => ({})) })),
}));

import { generateText } from "ai";
import { countMismatchedEvidence } from "@/lib/services/ai.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.AI_PROVIDER = "qwen";
  process.env.QWEN_API_KEY = "test";
  process.env.QWEN_BASE_URL = "https://example.test";
  process.env.QWEN_MODEL = "qwen-plus";
});

describe("countMismatchedEvidence", () => {
  it("returns 0 when all studentText found in transcript", () => {
    const n = countMismatchedEvidence(
      [
        {
          evidence: [
            { studentText: "您好，请问您的风险偏好如何" },
            { studentText: "我建议您配置 50% 股票" },
          ],
        },
      ],
      "您好，请问您的风险偏好如何\n我建议您配置 50% 股票",
    );
    expect(n).toBe(0);
  });

  it("counts each fabricated quote", () => {
    const n = countMismatchedEvidence(
      [
        {
          evidence: [
            { studentText: "实际在对话中说的话" },
            { studentText: "AI 凭空编造的话" },
            { studentText: "另一句编造的话" },
          ],
        },
      ],
      "实际在对话中说的话\n其他内容",
    );
    expect(n).toBe(2);
  });

  it("does not count empty studentText (AI declared no quote)", () => {
    const n = countMismatchedEvidence(
      [{ evidence: [{ studentText: "" }, { studentText: "找得到的" }] }],
      "找得到的",
    );
    expect(n).toBe(0);
  });

  it("handles missing evidence field gracefully", () => {
    const n = countMismatchedEvidence([{}], "anything");
    expect(n).toBe(0);
  });

  it("counts across multiple rubric items", () => {
    const n = countMismatchedEvidence(
      [
        { evidence: [{ studentText: "ok" }, { studentText: "missing1" }] },
        { evidence: [{ studentText: "also missing" }] },
      ],
      "ok",
    );
    expect(n).toBe(2);
  });
});

describe("evaluateSimulation evidence wiring", () => {
  const input = { taskName: "理财", scenario: "咨询", strictnessLevel: "MODERATE", transcript: [{ role: "student", text: "收益与风险相关" }], rubric: [{ id: "C1", name: "风险", maxPoints: 10 }] };
  const response = (evidence: unknown) => ({ text: JSON.stringify({ totalScore: 5, feedback: "反馈", rubricBreakdown: [{ criterionId: "C1", score: 5, maxScore: 10, comment: "评语", ...(evidence === undefined ? {} : { evidence }) }] }), usage: { inputTokens: 100, outputTokens: 30 } });
  it("preserves verified student evidence", async () => {
    mk(generateText).mockResolvedValue(response([{ studentText: "收益与风险相关", comment: "正确识别风险" }]));
    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    const result = await evaluateSimulation("u", input);
    expect(result.rubricBreakdown[0].evidence[0]).toMatchObject({ studentText: "收益与风险相关", unverified: false });
  });
  it("rejects fabricated evidence after one evidence retry", async () => {
    mk(generateText).mockResolvedValue(response([{ studentText: "学生没说过", comment: "编造" }]));
    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    await expect(evaluateSimulation("u", input)).rejects.toThrow("AI_EVIDENCE_INVALID");
    expect(generateText).toHaveBeenCalledTimes(2);
  });
  it("recovers when the evidence retry replaces a fabricated quote with the actual student sentence", async () => {
    mk(generateText).mockResolvedValueOnce(response([{ studentText: "编造的话", comment: "错误引用" }]))
      .mockResolvedValueOnce(response([{ studentText: "收益与风险相关", comment: "学生原话" }]));
    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    const result = await evaluateSimulation("u", input);
    expect(result.totalScore).toBe(5);
    expect(result.rubricBreakdown[0].evidence[0].studentText).toBe("收益与风险相关");
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(mk(generateText).mock.calls[1][0].prompt).toContain("上一轮你引用的 1 条");
  });
  it("rejects a customer quote misattributed to the student", async () => {
    mk(generateText).mockResolvedValue(response([{ studentText: "客户说的话", comment: "不属于学生" }]));
    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    await expect(evaluateSimulation("u", { ...input, transcript: [...input.transcript, { role: "ai", text: "客户说的话" }] })).rejects.toThrow("AI_EVIDENCE_INVALID");
  });
  it("does not repair truncated grading JSON into a partial success", async () => {
    const full = response([{ studentText: "收益与风险相关", comment: "原话" }]);
    mk(generateText).mockResolvedValue({ ...full, text: full.text.slice(0, -1) });
    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    await expect(evaluateSimulation("u", input)).rejects.toThrow();
    expect(generateText).toHaveBeenCalledTimes(3);
  });
  it.each([undefined, [], Array.from({length:4}, () => ({studentText:"收益与风险相关",comment:"依据"}))])("rejects missing or oversized evidence arrays: %s", async (evidence) => {
    mk(generateText).mockResolvedValue(response(evidence));
    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    await expect(evaluateSimulation("u", input)).rejects.toThrow();
  });
});
