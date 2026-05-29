import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
    aiToolSetting: { findUnique: vi.fn() },
  },
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

// Mock provider creation to avoid env-dependent code paths
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    chat: vi.fn(() => ({})),
  })),
}));

import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_PROVIDER = "qwen";
  process.env.QWEN_API_KEY = "test-key";
  process.env.QWEN_BASE_URL = "https://example.test";
  process.env.QWEN_MODEL = "qwen-plus";
});

describe("AiRun tokens + summary persistence (Unit 11)", () => {
  it("createAiRun writes summary as userPrompt's first 200 chars (明文)", async () => {
    mk(prisma.aiRun.create).mockResolvedValue({ id: "run-1" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({
      text: "hello",
      usage: { inputTokens: 50, outputTokens: 12 },
    });

    const { aiGenerateText } = await import("@/lib/services/ai.service");
    const userPrompt = "请生成一份周课表 ".repeat(40); // > 200 chars
    await aiGenerateText("weeklyInsight", "u1", "sys", userPrompt);

    const createCall = mk(prisma.aiRun.create).mock.calls[0]?.[0];
    expect(createCall?.data?.summary).toBeDefined();
    expect(createCall?.data?.summary.length).toBe(200);
    expect(createCall?.data?.summary).toBe(userPrompt.slice(0, 200));
  });

  it("finishAiRun persists inputTokens + outputTokens + costEstUSD on success", async () => {
    mk(prisma.aiRun.create).mockResolvedValue({ id: "run-2" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({
      text: "result",
      usage: { inputTokens: 1000, outputTokens: 500 },
    });

    const { aiGenerateText } = await import("@/lib/services/ai.service");
    await aiGenerateText("weeklyInsight", "u2", "sys", "short prompt");

    const updateCall = mk(prisma.aiRun.update).mock.calls[0]?.[0];
    expect(updateCall?.data?.status).toBe("succeeded");
    expect(updateCall?.data?.inputTokens).toBe(1000);
    expect(updateCall?.data?.outputTokens).toBe(500);
    // qwen-plus default model → cost = (1000 * 0.0008 + 500 * 0.002) / 1000 = 0.0018
    expect(updateCall?.data?.costEstUSD).toBeCloseTo(0.0018, 6);
  });

  it("finishAiRun estimates costEstUSD for mimo model (default mimo-v2.5-pro)", async () => {
    // mimo provider 经 AI_PROVIDER=mimo 解析；model 走 MIMO_MODEL=mimo-v2.5-pro
    // （feature weeklyInsight 无 AI_WEEKLY_INSIGHT_MODEL → 回退 provider.defaultModel）。
    process.env.AI_PROVIDER = "mimo";
    process.env.MIMO_API_KEY = "test-key";
    process.env.MIMO_BASE_URL = "https://example.test";
    process.env.MIMO_MODEL = "mimo-v2.5-pro";
    mk(prisma.aiRun.create).mockResolvedValue({ id: "run-mimo" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({
      text: "result",
      usage: { inputTokens: 1000, outputTokens: 500 },
    });

    const { aiGenerateText } = await import("@/lib/services/ai.service");
    await aiGenerateText("weeklyInsight", "u-mimo", "sys", "short prompt");

    const updateCall = mk(prisma.aiRun.update).mock.calls[0]?.[0];
    expect(updateCall?.data?.status).toBe("succeeded");
    expect(updateCall?.data?.inputTokens).toBe(1000);
    expect(updateCall?.data?.outputTokens).toBe(500);
    // mimo-v2.5-pro (CNY) → cost = (1000 * 0.003 + 500 * 0.006) / 1000 = 0.006
    expect(updateCall?.data?.costEstUSD).toBeCloseTo(0.006, 6);
  });

  it("finishAiRun returns costEstUSD=null when model not in COST_PER_1K_TOKENS table", async () => {
    process.env.QWEN_MODEL = "qwen-experimental-unknown";
    mk(prisma.aiRun.create).mockResolvedValue({ id: "run-3" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({
      text: "x",
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const { aiGenerateText } = await import("@/lib/services/ai.service");
    await aiGenerateText("weeklyInsight", "u3", "sys", "prompt");

    const updateCall = mk(prisma.aiRun.update).mock.calls[0]?.[0];
    expect(updateCall?.data?.inputTokens).toBe(100);
    expect(updateCall?.data?.costEstUSD).toBeNull();
  });

  it("finishAiRun persists inputTokens=null when SDK omits usage", async () => {
    mk(prisma.aiRun.create).mockResolvedValue({ id: "run-4" });
    mk(prisma.aiRun.update).mockResolvedValue({});
    mk(generateText).mockResolvedValue({ text: "x" });

    const { aiGenerateText } = await import("@/lib/services/ai.service");
    await aiGenerateText("weeklyInsight", "u4", "sys", "prompt");

    const updateCall = mk(prisma.aiRun.update).mock.calls[0]?.[0];
    expect(updateCall?.data?.inputTokens).toBeNull();
    expect(updateCall?.data?.outputTokens).toBeNull();
    expect(updateCall?.data?.costEstUSD).toBeNull();
  });
});
