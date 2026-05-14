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

import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";
import { countMismatchedEvidence } from "@/lib/services/ai.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
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

describe("evaluateSimulation evidence wiring (Unit 9)", () => {
  it("propagates evidence from AI response; flags unverified for fabricated quotes", async () => {
    mk(prisma.aiRun.create).mockResolvedValue({ id: "r1" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({
      text: JSON.stringify({
        totalScore: 18,
        feedback: "整体表现不错",
        rubricBreakdown: [
          {
            criterionId: "C1",
            score: 9,
            maxScore: 10,
            comment: "沟通清晰",
            evidence: [
              { studentText: "您好，我是您的理财顾问", comment: "礼貌开场" },
            ],
          },
          {
            criterionId: "C2",
            score: 9,
            maxScore: 10,
            comment: "专业",
            evidence: [
              { studentText: "捏造的原话", comment: "AI 编的" },
            ],
          },
        ],
        conceptTags: ["资产配置"],
      }),
      usage: { inputTokens: 200, outputTokens: 80 },
    });

    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    const result = await evaluateSimulation("u1", {
      taskName: "理财咨询",
      requirements: "",
      scenario: "客户咨询理财",
      strictnessLevel: "MODERATE",
      transcript: [
        { role: "student", text: "您好，我是您的理财顾问" },
        { role: "client", text: "请问怎么配置？" },
      ],
      rubric: [
        { id: "C1", name: "沟通", maxPoints: 10 },
        { id: "C2", name: "专业", maxPoints: 10 },
      ],
    });

    expect(result.rubricBreakdown).toHaveLength(2);
    expect(result.rubricBreakdown[0].evidence?.[0]?.studentText).toBe(
      "您好，我是您的理财顾问",
    );
    expect(result.rubricBreakdown[0].evidence?.[0]?.unverified).toBe(false);
    // C2's fabricated quote → unverified=true
    expect(result.rubricBreakdown[1].evidence?.[0]?.studentText).toBe("捏造的原话");
    expect(result.rubricBreakdown[1].evidence?.[0]?.unverified).toBe(true);
  });

  it("retries when evidence mismatches; accepts after second attempt with unverified flag", async () => {
    mk(prisma.aiRun.create).mockResolvedValue({ id: "r2" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    // First call: fabricated quote; second call: also fabricated
    mk(generateText)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          totalScore: 5,
          feedback: "f",
          rubricBreakdown: [
            {
              criterionId: "C1",
              score: 5,
              maxScore: 10,
              comment: "c",
              evidence: [{ studentText: "假的", comment: "x" }],
            },
          ],
        }),
        usage: { inputTokens: 100, outputTokens: 30 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          totalScore: 5,
          feedback: "f",
          rubricBreakdown: [
            {
              criterionId: "C1",
              score: 5,
              maxScore: 10,
              comment: "c",
              evidence: [{ studentText: "仍然假的", comment: "x" }],
            },
          ],
        }),
        usage: { inputTokens: 100, outputTokens: 30 },
      });

    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    const result = await evaluateSimulation("u1", {
      taskName: "T",
      scenario: "S",
      strictnessLevel: "MODERATE",
      transcript: [{ role: "student", text: "真的原话" }],
      rubric: [{ id: "C1", name: "C", maxPoints: 10 }],
    });

    // generateText called 2 times (1 initial + 1 evidence retry)
    expect(mk(generateText).mock.calls.length).toBe(2);
    expect(result.rubricBreakdown[0].evidence?.[0]?.unverified).toBe(true);
  });

  it("limits evidence to 3 entries per rubric (防爆量)", async () => {
    mk(prisma.aiRun.create).mockResolvedValue({ id: "r3" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({
      text: JSON.stringify({
        totalScore: 5,
        feedback: "f",
        rubricBreakdown: [
          {
            criterionId: "C1",
            score: 5,
            maxScore: 10,
            comment: "c",
            evidence: [
              { studentText: "a", comment: "1" },
              { studentText: "b", comment: "2" },
              { studentText: "c", comment: "3" },
              { studentText: "d", comment: "4" },
              { studentText: "e", comment: "5" },
            ],
          },
        ],
      }),
      usage: { inputTokens: 100, outputTokens: 30 },
    });

    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    const result = await evaluateSimulation("u1", {
      taskName: "T",
      scenario: "S",
      strictnessLevel: "MODERATE",
      transcript: [{ role: "student", text: "abcde" }],
      rubric: [{ id: "C1", name: "C", maxPoints: 10 }],
    });

    expect(result.rubricBreakdown[0].evidence).toHaveLength(3);
  });

  it("defaults evidence to [] when AI omits the field (旧 prompt 兼容)", async () => {
    mk(prisma.aiRun.create).mockResolvedValue({ id: "r4" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({
      text: JSON.stringify({
        totalScore: 5,
        feedback: "f",
        rubricBreakdown: [
          { criterionId: "C1", score: 5, maxScore: 10, comment: "c" },
        ],
      }),
      usage: { inputTokens: 100, outputTokens: 30 },
    });

    const { evaluateSimulation } = await import("@/lib/services/ai.service");
    const result = await evaluateSimulation("u1", {
      taskName: "T",
      scenario: "S",
      strictnessLevel: "MODERATE",
      transcript: [{ role: "student", text: "hi" }],
      rubric: [{ id: "C1", name: "C", maxPoints: 10 }],
    });

    expect(result.rubricBreakdown[0].evidence).toEqual([]);
  });
});
