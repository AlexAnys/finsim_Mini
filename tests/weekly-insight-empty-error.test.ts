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
import { captureAiRunStarted, captureAiRunFinished } from "@/lib/services/ai-run-context";
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

  it("AI 失败保留全量成绩统计，标记 aiUnavailable，不误报无数据", async () => {
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
    expect(r.payload.emptyState).not.toBe(true);
    expect(r.payload.aiUnavailable).toBe(true);
    expect(r.payload.classDifferences).toEqual([expect.objectContaining({ classId: "cl1", avgScore: 80 })]);
    expect(r.payload.studentClusters.reduce((sum, group) => sum + group.size, 0)).toBe(1);
    expect(r.payload.highlightSummary).toContain("AI 生成超时");
    expect(r.modelUsed).toBeNull(); // AI 失败时 modelUsed 在 succeeded path 才赋值
  });
});

describe("weekly insight full-data statistics and bounded evidence", () => {
  it("counts >200 records exactly, takes latest attempts, and samples older minority classes", async () => {
    const row = (index: number, classId: string, score: number, maxScore: number) => ({
      id: `sub-${index}`, studentId: `student-${index}`, taskId: "task", taskInstanceId: `instance-${classId}`,
      score, maxScore, student: { id: `student-${index}`, name: "同名学生" },
      task: { id: "task", taskName: "任务", taskType: "quiz" },
      taskInstance: { class: { id: classId, name: "同名班" }, course: { id: `course-${classId}`, courseTitle: "同名课" }, chapter: null, section: null },
      quizSubmission: { conceptTags: ["风险"], evaluation: { feedback: `feedback-${classId}` } },
      simulationSubmission: null, subjectiveSubmission: null,
    });
    const latestA = row(0, "A", 10, 10);
    const submissions = [latestA, ...Array.from({ length: 204 }, (_, index) => row(index + 1, "A", 10, 10)),
      row(205, "B", 20, 100), row(206, "C", 8, 10), { ...latestA, id: "old-low-attempt", score: 0 }];
    mk(prisma.submission.findMany).mockResolvedValue(submissions);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(aiGenerateJSON).mockResolvedValue({
      weakConceptsByCourse: [{ courseId: "invented-course" }],
      classDifferences: [{ classId: "invented-class", avgScore: 999 }],
      studentClusters: [{ size: 999 }],
      upcomingClassRecommendations: [{ scheduleSlotId: "invented-slot", date: "2026-09-12", courseTitle: "invented", recommendation: "invented" }],
      highlightSummary: "本周教学需关注样本中的反馈。",
    });
    const result = await generateWeeklyInsight("teacher-all-samples");
    expect(result.submissionCount).toBe(207);
    expect(result.sampledSubmissionCount).toBe(80);
    expect(result.payload.classDifferences).toEqual([
      expect.objectContaining({ classId: "A", avgScore: 100 }),
      expect.objectContaining({ classId: "B", avgScore: 20 }),
      expect.objectContaining({ classId: "C", avgScore: 80 }),
    ]);
    expect(result.payload.studentClusters.reduce((sum, cluster) => sum + cluster.size, 0)).toBe(207);
    expect(result.payload.weakConceptsByCourse).toEqual([expect.objectContaining({ courseId: "course-B", concepts: [expect.objectContaining({ tag: "风险", errorRate: 1 })] })]);
    expect(result.payload.upcomingClassRecommendations).toEqual([]);
    const prompt = mk(aiGenerateJSON).mock.calls[0][3] as string;
    expect(prompt.match(/\bsub=/g)).toHaveLength(80);
    expect(prompt).toContain("80 / 207 条");
    expect(prompt).toContain("覆盖 3 / 3 组");
    expect(prompt).toContain("sub=sub-205");
    expect(prompt).toContain("sub=sub-206");
    expect(prompt).not.toContain("old-low-attempt");
    expect(prompt).toContain('"avgScore":20');
    expect(prompt).toContain('"size":206');
  });

  it("uses this generation's receipt and never queries the user's latest run", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([{
      id: "submission", studentId: "student", taskId: "task", taskInstanceId: "instance",
      score: 10, maxScore: 10, student: { id: "student", name: "学生" },
      task: { id: "task", taskName: "任务", taskType: "quiz" }, taskInstance: null,
      quizSubmission: null, subjectiveSubmission: null, simulationSubmission: null,
    }]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(prisma.aiRun.findFirst).mockResolvedValue({ inputTokens: 99999, outputTokens: 99999, costEstUSD: 999 });
    mk(aiGenerateJSON).mockImplementation(async () => {
      captureAiRunStarted({ runId: "own-run", feature: "weeklyInsight", provider: "qwen", model: "qwen-plus" });
      captureAiRunFinished("own-run", { status: "succeeded", inputTokens: 123, outputTokens: 45, costEstUSD: 0.01 });
      return { upcomingClassRecommendations: [], highlightSummary: "本周教学需关注" };
    });
    const result = await generateWeeklyInsight("teacher-own-receipt");
    expect(result).toMatchObject({ inputTokens: 123, outputTokens: 45, costEstUSD: 0.01 });
    expect(prisma.aiRun.findFirst).not.toHaveBeenCalled();
  });
});
