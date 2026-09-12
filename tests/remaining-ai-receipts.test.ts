import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/db/prisma", () => ({ prisma: {
  aiToolSetting: { findUnique: vi.fn() },
  aiRun: { create: vi.fn(), update: vi.fn() },
} }));
vi.mock("ai", () => ({ generateText: vi.fn(), streamText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn(() => ({ chat: (model: string) => ({ model }) })) }));

import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";
import { aiGenerateJSON, aiGenerateText } from "@/lib/services/ai.service";
import { captureAiRuns, summarizeAiRuns } from "@/lib/services/ai-run-context";

const original = { ...process.env };
beforeEach(() => {
  vi.resetAllMocks();
  for (const key of Object.keys(process.env)) if (/^(AI_|MIMO_|QWEN_|DEEPSEEK_|GEMINI_|OPENAI_)/.test(key)) delete process.env[key];
  process.env.AI_PROVIDER = "qwen";
  process.env.QWEN_API_KEY = "local-fixture";
  process.env.QWEN_MODEL = "qwen-plus";
  vi.mocked(prisma.aiToolSetting.findUnique).mockResolvedValue(null);
  let index = 0;
  vi.mocked(prisma.aiRun.create).mockImplementation(() => Promise.resolve({ id: `run-${++index}` }) as never);
  vi.mocked(prisma.aiRun.update).mockResolvedValue({} as never);
  vi.mocked(generateText).mockResolvedValue({ text: '{"ok":true}', usage: { inputTokens: 100, outputTokens: 50 } } as never);
});
afterEach(() => { process.env = { ...original }; });

describe("business-scoped AI receipts", () => {
  it("keeps concurrent same-user operations separate and sums every call and JSON repair", async () => {
    let releaseA!: () => void;
    let startedA!: () => void;
    const aStarted = new Promise<void>((resolve) => { startedA = resolve; });
    vi.mocked(generateText).mockImplementationOnce(async () => {
      startedA();
      await new Promise<void>((resolve) => { releaseA = resolve; });
      return { text: "invalid json", usage: { inputTokens: 100, outputTokens: 50 } } as never;
    });
    const a = captureAiRuns({ submissionId: "submission-a" }, async () => {
      await aiGenerateJSON("quizGrade", "same-student", "system", "answer-a", z.object({ ok: z.boolean() }));
      await aiGenerateText("quizGrade", "same-student", "system", "tags-a");
    });
    await aStarted;
    const b = await captureAiRuns({ submissionId: "submission-b" }, () =>
      aiGenerateText("quizGrade", "same-student", "system", "answer-b"));
    releaseA();
    const aResult = await a;
    expect(summarizeAiRuns(aResult.runs)).toMatchObject({ runIds: ["run-1", "run-3"], inputTokens: 300, outputTokens: 150 });
    expect(summarizeAiRuns(b.runs)).toMatchObject({ runIds: ["run-2"], inputTokens: 100, outputTokens: 50 });
    expect(vi.mocked(prisma.aiRun.create).mock.calls.map(([args]) => args.data.metadata)).toEqual([
      expect.objectContaining({ submissionId: "submission-a" }),
      expect.objectContaining({ submissionId: "submission-b" }),
      expect.objectContaining({ submissionId: "submission-a" }),
    ]);
  });

  it("retains unknown usage if an earlier JSON repair omitted a usage field", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "invalid json", usage: { outputTokens: 50 } } as never);
    const captured = await captureAiRuns({ submissionId: "incomplete-usage" }, () =>
      aiGenerateJSON("quizGrade", "usage-student", "system", "answer", z.object({ ok: z.boolean() })));
    expect(summarizeAiRuns(captured.runs)).toMatchObject({ inputTokens: null, outputTokens: 100, costEstUSD: null });
    expect(prisma.aiRun.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ inputTokens: null, outputTokens: 100, costEstUSD: null }) }));
  });

  it("does not show a partial total when a fallback request or audit receipt is unaccounted", async () => {
    process.env.AI_FALLBACK_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "local-fixture";
    vi.mocked(generateText).mockRejectedValueOnce(new Error("503"));
    const fallback = await captureAiRuns({ submissionId: "fallback" }, () =>
      aiGenerateText("quizGrade", "fallback-student", "system", "answer"));
    expect(summarizeAiRuns(fallback.runs)).toMatchObject({ runIds: ["run-1", "run-2"], provider: "deepseek", inputTokens: null, costEstUSD: null });
    vi.mocked(prisma.aiRun.create).mockRejectedValueOnce(new Error("audit temporarily unavailable"));
    const missing = await captureAiRuns({ submissionId: "missing-receipt" }, async () => {
      await aiGenerateText("quizGrade", "receipt-student", "system", "answer");
      await aiGenerateText("quizGrade", "receipt-student", "system", "tags");
    });
    expect(summarizeAiRuns(missing.runs)).toMatchObject({ inputTokens: null, outputTokens: null, costEstUSD: null });
  });
});
