import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    submission: { findMany: vi.fn() },
    scheduleSlot: { findMany: vi.fn() },
    aiRun: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
  getProviderForFeature: vi.fn(() => ({
    provider: { name: "qwen" },
    model: "qwen-plus",
  })),
  getRuntimeSetting: vi.fn(() => null),
}));

import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  __clearWeeklyInsightCache,
  classifyAiErrorSummary,
  generateWeeklyInsight,
} from "@/lib/services/weekly-insight.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  __clearWeeklyInsightCache();
});

describe("classifyAiErrorSummary — Unit 15 错误分级", () => {
  it("超时 (timeout)", () => {
    expect(classifyAiErrorSummary(new Error("Request timeout"))).toContain(
      "AI 生成超时",
    );
  });
  it("超时 (aborted)", () => {
    expect(classifyAiErrorSummary(new Error("operation aborted"))).toContain(
      "AI 生成超时",
    );
  });
  it("超时 (AbortError)", () => {
    const err = new Error("aborted by user");
    err.name = "AbortError";
    expect(classifyAiErrorSummary(err)).toContain("AI 生成超时");
  });
  it("配额耗尽 (rate limit)", () => {
    expect(
      classifyAiErrorSummary(new Error("HTTP 429 rate limit reached")),
    ).toContain("AI 服务繁忙");
  });
  it("配额耗尽 (quota)", () => {
    expect(classifyAiErrorSummary(new Error("Quota exceeded"))).toContain(
      "AI 服务繁忙",
    );
  });
  it("模型未配置 (NOT_CONFIGURED)", () => {
    expect(
      classifyAiErrorSummary(new Error("AI_PROVIDER_NOT_CONFIGURED: qwen")),
    ).toContain("AI 模型未配置");
  });
  it("其他错误 → 通用文案带前 100 字 err msg", () => {
    const msg = classifyAiErrorSummary(new Error("Some weird error message X"));
    expect(msg).toContain("AI 服务暂不可用");
    expect(msg).toContain("Some weird error message X");
  });
  it("超长 err message 被截到 100 字 + 省略号", () => {
    const longErr = new Error("a".repeat(200));
    const msg = classifyAiErrorSummary(longErr);
    expect(msg).toContain("...");
    // 实际拼接：name+message → 不会无界限增长
    expect(msg.length).toBeLessThan(200);
  });
  it("非 Error 类型 (字符串)", () => {
    expect(classifyAiErrorSummary("plain string")).toContain("AI 服务暂不可用");
  });
  it("非 Error 类型 (object)", () => {
    expect(classifyAiErrorSummary({ foo: 1 })).toContain("未知错误");
  });
});

describe("generateWeeklyInsight — Unit 15 emptyState short-circuit", () => {
  it("0 submissions → emptyState=true + 不调 AI + modelUsed=null + durationMs=0", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);

    const r = await generateWeeklyInsight("teacher-empty-1");

    expect(r.payload.emptyState).toBe(true);
    expect(r.payload.weakConceptsByCourse).toEqual([]);
    expect(r.payload.classDifferences).toEqual([]);
    expect(r.payload.studentClusters).toEqual([]);
    expect(r.payload.upcomingClassRecommendations).toEqual([]);
    expect(r.payload.highlightSummary).toContain("尚无");
    expect(r.modelUsed).toBeNull();
    expect(r.durationMs).toBe(0);
    expect(r.submissionCount).toBe(0);
    // 关键：AI 未被调用
    expect(mk(aiGenerateJSON)).not.toHaveBeenCalled();
  });

  it("0 submissions 第二次调用命中 cache (cached=true, AI 不再被调)", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);

    const r1 = await generateWeeklyInsight("teacher-empty-2");
    expect(r1.cached).toBe(false);

    const r2 = await generateWeeklyInsight("teacher-empty-2");
    expect(r2.cached).toBe(true);
    // cache 透传 emptyState
    expect(r2.payload.emptyState).toBe(true);

    expect(mk(aiGenerateJSON)).not.toHaveBeenCalled();
  });

  it("AI 失败时 payload 标 emptyState=true + highlightSummary 用 classifyAiErrorSummary", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([
      {
        id: "s1",
        score: 80,
        maxScore: 100,
        student: { id: "u1", name: "甲" },
        task: { id: "t1", taskName: "T1", taskType: "simulation" },
        taskInstance: {
          class: { id: "cl1", name: "A班" },
          course: { id: "co1", courseTitle: "理财" },
          chapter: null,
          section: null,
        },
        simulationSubmission: { conceptTags: [], evaluation: null },
        quizSubmission: null,
        subjectiveSubmission: null,
      },
    ]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(aiGenerateJSON).mockRejectedValue(new Error("Request timeout 30s"));

    const r = await generateWeeklyInsight("teacher-ai-fail");
    expect(r.payload.emptyState).toBe(true);
    expect(r.payload.highlightSummary).toContain("AI 生成超时");
    expect(r.modelUsed).toBeNull(); // AI 失败时 modelUsed 在 succeeded path 才赋值
  });
});
