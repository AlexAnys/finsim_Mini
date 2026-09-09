import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("@/lib/db/prisma", () => ({ prisma: { aiToolSetting: { findUnique: vi.fn() }, aiRun: { create: vi.fn(), update: vi.fn() } } }));
vi.mock("ai", () => ({ generateText: vi.fn(), streamText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn((config) => ({ chat: (model: string) => ({ model, baseURL: config.baseURL }) })) }));
import { prisma } from "@/lib/db/prisma";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { aiGenerateJSON, aiGenerateText, evaluateSimulation, chatReplyStream } from "@/lib/services/ai.service";
import { createRubricEvaluationSchema } from "@/lib/services/ai-grade-validation";
import { weeklyStatistics } from "@/lib/services/insight-statistics";
import { withAiDeadline } from "@/lib/services/ai-deadline-context";
const original = { ...process.env };
beforeEach(() => {
  vi.resetAllMocks();
  for (const key of Object.keys(process.env)) if (/^(AI_|MIMO_|QWEN_|DEEPSEEK_|GEMINI_|OPENAI_)/.test(key)) delete process.env[key];
  process.env.MIMO_API_KEY = "mock";
  process.env.DEEPSEEK_API_KEY = "mock";
  vi.mocked(prisma.aiToolSetting.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.aiRun.create).mockResolvedValue({ id: "run" } as never);
  vi.mocked(prisma.aiRun.update).mockResolvedValue({} as never);
  vi.mocked(generateText).mockResolvedValue({ text: '{"ok":true}', usage: { inputTokens: 100, outputTokens: 50 } } as never);
});
afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals(); });

describe("pilot AI contracts", () => {
  it("terminates an adapter that never resolves within the action budget", async () => {
    vi.mocked(generateText).mockImplementation(() => new Promise(() => {}));
    await expect(aiGenerateText("studyBuddyReply", "u", "s", "p", { timeoutMs: 15 })).rejects.toThrow("AI_TIMEOUT");
    expect(vi.mocked(generateText).mock.calls[0][0]).toMatchObject({ maxRetries: 0, timeout: expect.any(Number), abortSignal: expect.any(AbortSignal) });
  });
  it("uses the configured fallback on actual upstream failure, recording both providers", async () => {
    process.env.AI_PROVIDER = "deepseek"; process.env.DEEPSEEK_API_KEY = "mock"; process.env.AI_FALLBACK_PROVIDER = "mimo";
    vi.mocked(generateText).mockRejectedValueOnce(new Error("HTTP 503")).mockResolvedValueOnce({ text: "recovered", usage: {} } as never);
    let actual;
    expect(await aiGenerateText("studyBuddyReply", "u", "s", "p", { onResolved: (r) => { actual = r; } })).toBe("recovered");
    expect(actual).toMatchObject({ provider: "mimo" });
    expect(vi.mocked(prisma.aiRun.create).mock.calls.map(([args]) => args.data.provider)).toEqual(["deepseek", "mimo"]);
  });
  it("diagnostics use exactly the unsaved override and never fall back", async () => {
    process.env.DEEPSEEK_API_KEY = "mock";
    vi.mocked(prisma.aiToolSetting.findUnique).mockResolvedValue({ provider: "mimo", model: "mimo-v2.5" } as never);
    let actual;
    await aiGenerateText("simulation", "u", "s", "p", { runtimeSetting: { provider: "deepseek", model: "deepseek-v4-pro" }, allowFallback: false, onResolved: (r) => { actual = r; } });
    expect(actual).toMatchObject({ provider: "deepseek", model: "deepseek-v4-pro" });
    expect(prisma.aiToolSetting.findUnique).not.toHaveBeenCalled();
    vi.mocked(generateText).mockRejectedValue(new Error("401"));
    await expect(aiGenerateText("simulation", "u", "s", "p", { runtimeSetting: { provider: "deepseek", model: "deepseek-v4-pro" }, allowFallback: false })).rejects.toThrow("401");
  });
  it("falls back from a failed stream before showing any text", async () => {
    process.env.AI_PROVIDER = "deepseek"; process.env.DEEPSEEK_API_KEY = "mock"; process.env.AI_FALLBACK_PROVIDER = "mimo";
    vi.mocked(streamText).mockReturnValue({ textStream: (async function* () { throw new Error("503"); yield ""; })(), totalUsage: Promise.resolve({}) } as never);
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify({ reply: "恢复后的客户回复", mood_score: 0.3, mood_label: "犹豫", student_perf: 0.8, deviated_dimensions: [] }), usage: {} } as never);
    const stream = await chatReplyStream("u", { scenario: "咨询", transcript: [{ role: "student", text: "您好" }] });
    const chunks = [];
    for await (const chunk of stream.replyStream) chunks.push(chunk);
    expect(chunks.join("")).toBe("恢复后的客户回复");
    expect((await stream.meta()).reply).toBe("恢复后的客户回复");
  });
  it("bounds the extra hint with the same stream action deadline", async () => {
    const raw = JSON.stringify({ reply: "客户回复", mood_score: 0.3, mood_label: "犹豫", student_perf: 0.2, deviated_dimensions: ["风险"] });
    vi.mocked(streamText).mockReturnValue({ textStream: (async function* () { yield raw; })(), totalUsage: Promise.resolve({}) } as never);
    vi.mocked(generateText).mockImplementation(() => new Promise(() => {}));
    const stream = await chatReplyStream("u", { scenario: "咨询", transcript: Array.from({length:3}, () => ({ role: "student", text: "您好" })) }, { timeoutMs: 20 });
    for await (const chunk of stream.replyStream) expect(chunk).toBe("客户回复");
    expect(await stream.meta()).toMatchObject({ reply: "客户回复", hint: undefined });
  });
  it("counts every charged JSON repair response", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "bad-json", usage: { inputTokens: 100, outputTokens: 50 } } as never);
    await aiGenerateJSON("quizGrade", "u", "s", "p", z.object({ ok: z.boolean() }));
    expect(prisma.aiRun.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ inputTokens: 200, outputTokens: 100, status: "succeeded" }) }));
  });
  it("shares a deadline across multiple AI calls", async () => {
    await expect(withAiDeadline(-1, () => aiGenerateText("quizGrade", "u", "s", "p"))).rejects.toThrow("AI_TIMEOUT");
    expect(generateText).not.toHaveBeenCalled();
  });
  it("sends DeepSeek thinking as a real HTTP body field", async () => {
    process.env.DEEPSEEK_API_KEY = "mock";
    const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
    await aiGenerateText("simulation", "u", "s", "p", { runtimeSetting: { provider: "deepseek", model: "deepseek-v4-flash" } });
    const config = vi.mocked(createOpenAI).mock.calls[0][0]!;
    await config.fetch!("https://example.invalid/chat/completions", { body: JSON.stringify({ model: "deepseek-v4-flash", reasoning_effort: "low" }) });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ thinking: { type: "disabled" } });
  });
  it("rejects incomplete rubric rather than filling an omitted criterion with zero", async () => {
    const partial = { totalScore: 20, feedback: "ok", rubricBreakdown: [{ criterionId: "r1", score: 20, maxScore: 50, comment: "ok", evidence: [{ studentText: "原句", comment: "依据" }] }] };
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(partial), usage: {} } as never);
    await expect(evaluateSimulation("u", { taskName: "t", scenario: "s", strictnessLevel: "STRICT", transcript: [{ role: "student", text: "原句" }], rubric: [{ id: "r1", name: "一", maxPoints: 50 }, { id: "r2", name: "二", maxPoints: 50 }] })).rejects.toThrow();
    expect(generateText).toHaveBeenCalledTimes(3);
  });
  it("rejects duplicate, negative and inconsistent rubric grades", () => {
    const schema = createRubricEvaluationSchema([{ id: "r1", maxPoints: 10 }, { id: "r2", maxPoints: 10 }]);
    const item = { criterionId: "r1", score: 5, maxScore: 10, comment: "comment" };
    expect(schema.safeParse({ totalScore: 10, feedback: "ok", rubricBreakdown: [item, item] }).success).toBe(false);
    expect(schema.safeParse({ totalScore: 4, feedback: "ok", rubricBreakdown: [item, { ...item, criterionId: "r2", score: -1 }] }).success).toBe(false);
  });
  it("computes normalized equal-student class averages and exact group sizes", () => {
    const base = { courseId: "course", courseTitle: "课程", classId: "class", className: "同名班", conceptTags: ["风险"] };
    const rows = [{ ...base, submissionId: "a", studentId: "a", studentName: "甲", score: 10, maxScore: 10 }, { ...base, submissionId: "b", studentId: "b", studentName: "乙", score: 0, maxScore: 100 }, { ...base, submissionId: "c", studentId: "a", studentName: "甲", score: 100, maxScore: 100 }];
    const stats = weeklyStatistics(rows);
    expect(stats.classDifferences[0].avgScore).toBe(50);
    expect(stats.studentClusters.reduce((sum, group) => sum + group.size, 0)).toBe(2);
    expect(stats.weakConceptsByCourse[0].concepts[0].errorRate).toBe(0.5);
    expect(weeklyStatistics(rows.filter((row) => row.studentId === "a")).weakConceptsByCourse).toEqual([]);
  });
});
