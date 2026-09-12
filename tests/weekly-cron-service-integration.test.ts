import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/guards", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  user: { findMany: vi.fn() },
  submission: { findMany: vi.fn() },
  scheduleSlot: { findMany: vi.fn() },
  aiToolSetting: { findUnique: vi.fn() },
  aiRun: { create: vi.fn(), update: vi.fn() },
} }));
// Keep the cron, weekly service, prompt/statistics and AI service real. Only the external transport is replaced.
vi.mock("ai", () => ({ generateText: vi.fn(), streamText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn(() => ({ chat: (model: string) => ({ model }) })) }));

import { GET, POST } from "@/app/api/cron/weekly-insight/route";
import { getSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";
import * as weeklyService from "@/lib/services/weekly-insight.service";
import { __clearAiThrottleState } from "@/lib/services/ai-throttle.service";

const originalEnv = { ...process.env };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  weeklyService.__clearWeeklyInsightCache();
  __clearAiThrottleState();
  for (const key of Object.keys(process.env)) if (/^(AI_|MIMO_|QWEN_|DEEPSEEK_|GEMINI_|OPENAI_)/.test(key)) delete process.env[key];
  Object.assign(process.env, {
    CRON_TOKEN: "controlled-local-cron",
    AI_PROVIDER: "qwen", QWEN_API_KEY: "controlled-local-key", QWEN_MODEL: "qwen-plus",
    AI_FALLBACK_PROVIDER: "qwen", AI_FALLBACK_MODEL: "qwen-plus",
  });
  vi.mocked(prisma.user.findMany).mockResolvedValue(["failed", "empty", "succeeded"].map((id) => ({ id, email: `${id}@example.invalid` })) as never);
  vi.mocked(prisma.submission.findMany).mockImplementation((args) => {
    const teacherId = (args?.where?.OR?.[0] as { task: { creatorId: string } }).task.creatorId;
    const submissions = teacherId === "empty" ? [] : [{
      id: `sub-${teacherId}`, studentId: `student-${teacherId}`, taskId: "task", taskInstanceId: "instance",
      score: 8, maxScore: 10, student: { id: `student-${teacherId}`, name: "测试学生" },
      task: { id: "task", taskName: `feedback-${teacherId}`, taskType: "quiz" },
      taskInstance: { class: { id: "class", name: "测试班" }, course: { id: "course", courseTitle: "测试课" }, chapter: null, section: null },
      quizSubmission: { conceptTags: ["风险"], evaluation: { feedback: `feedback-${teacherId}` } },
      simulationSubmission: null, subjectiveSubmission: null,
    }];
    return Promise.resolve(submissions) as never;
  });
  vi.mocked(prisma.scheduleSlot.findMany).mockResolvedValue([]);
  vi.mocked(prisma.aiToolSetting.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.aiRun.create).mockResolvedValue({ id: "local-run" } as never);
  vi.mocked(prisma.aiRun.update).mockResolvedValue({} as never);
  vi.mocked(generateText).mockImplementation(async (args) => {
    if (String(args.prompt).includes("feedback-failed")) throw new Error("HTTP 503 controlled upstream failure");
    return { text: JSON.stringify({ upcomingClassRecommendations: [], highlightSummary: "本周教学需关注测试反馈。" }), usage: { inputTokens: 100, outputTokens: 50 } } as never;
  });
});
afterEach(() => { process.env = { ...originalEnv }; vi.restoreAllMocks(); });

describe("real weekly service -> cron result accounting", () => {
  it.each([["GET", GET], ["POST", POST]] as const)("%s counts actual AI failure, successful generation and no-data skip separately", async (method, handler) => {
    const generation = vi.spyOn(weeklyService, "generateWeeklyInsight");
    const response = await handler(new NextRequest("http://localhost/api/cron/weekly-insight", { method, headers: { "x-cron-token": "controlled-local-cron" } }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ total: 3, failed: 1, skipped: 1, succeeded: 1 });
    expect(body.data.results).toEqual([
      { teacherId: "failed", email: "failed@example.invalid", ok: false, skipped: false, error: "AI_INSIGHT_GENERATION_FAILED" },
      { teacherId: "empty", email: "empty@example.invalid", ok: true, skipped: true },
      { teacherId: "succeeded", email: "succeeded@example.invalid", ok: true, skipped: false },
    ]);
    const [failed, empty, succeeded] = await Promise.all(generation.mock.results.map((result) => result.value));
    expect(failed.payload).toMatchObject({ aiUnavailable: true, classDifferences: [expect.objectContaining({ avgScore: 80 })] });
    expect(failed.payload.emptyState).not.toBe(true);
    expect(empty).toMatchObject({ submissionCount: 0, payload: { emptyState: true } });
    expect(succeeded.payload.aiUnavailable).not.toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2); // No external call for the empty teacher.
    expect(getSession).not.toHaveBeenCalled(); // Exact cron token authorized this controlled test.
  });

  it.each(["teacher", "student"])("rejects %s before scanning teachers or invoking AI", async (role) => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "non-admin", role } } as never);
    for (const handler of [GET, POST]) {
      const response = await handler(new NextRequest("http://localhost/api/cron/weekly-insight"));
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
    }
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });
});
