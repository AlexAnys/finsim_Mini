import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskInstance: { findUnique: vi.fn() },
    submission: { findMany: vi.fn() },
    analysisReport: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  aggregateInsights,
  getCachedInsights,
} from "@/lib/services/insights.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("getCachedInsights", () => {
  it("returns null when no AnalysisReport exists", async () => {
    mk(prisma.analysisReport.findUnique).mockResolvedValue(null);
    const result = await getCachedInsights("ti1", "teacher1");
    expect(result).toBeNull();
  });

  it("returns null when report exists but has no commonIssues yet", async () => {
    mk(prisma.analysisReport.findUnique).mockResolvedValue({
      id: "r1",
      commonIssues: null,
      aggregatedAt: null,
      studentCount: 0,
    });
    const result = await getCachedInsights("ti1", "teacher1");
    expect(result).toBeNull();
  });

  it("returns parsed cache when report has aggregated data", async () => {
    const aggregatedAt = new Date("2026-04-25T10:00:00Z");
    mk(prisma.analysisReport.findUnique).mockResolvedValue({
      id: "r1",
      commonIssues: { commonIssues: [], highlights: [], weaknessConcepts: [] },
      aggregatedAt,
      studentCount: 12,
    });
    const result = await getCachedInsights("ti1", "teacher1");
    expect(result).not.toBeNull();
    expect(result?.studentCount).toBe(12);
    expect(result?.aggregatedAt).toBe(aggregatedAt);
    expect(result?.reportId).toBe("r1");
  });
});

describe("aggregateInsights", () => {
  it("throws INSTANCE_NOT_FOUND when instance missing", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue(null);
    await expect(aggregateInsights("missing", "t1")).rejects.toThrow(
      "INSTANCE_NOT_FOUND"
    );
  });

  it("throws NO_GRADED_SUBMISSIONS when no graded submissions", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      taskId: "t1",
      title: "Test",
      taskType: "simulation",
    });
    mk(prisma.submission.findMany).mockResolvedValue([]);
    await expect(aggregateInsights("ti1", "t1")).rejects.toThrow(
      "NO_GRADED_SUBMISSIONS"
    );
  });

  it("PR-FIX-3 C5: gracefully aggregates when no submission has conceptTags (empty weaknessConcepts, AI still runs)", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      taskId: "t1",
      title: "Test",
      taskType: "simulation",
    });
    mk(prisma.submission.findMany).mockResolvedValue([
      {
        id: "s1",
        score: 80,
        student: { id: "u1", name: "甲" },
        simulationSubmission: {
          conceptTags: [],
          evaluation: { feedback: "good" },
        },
        quizSubmission: null,
        subjectiveSubmission: null,
      },
    ]);
    mk(aiGenerateJSON).mockResolvedValue({ commonIssues: [], highlights: [] });
    mk(prisma.analysisReport.upsert).mockResolvedValue({ id: "r-empty" });

    const result = await aggregateInsights("ti1", "t1");

    // 不抛 NO_CONCEPT_TAGS（C5 移除了 throw）
    expect(result.commonIssues.weaknessConcepts).toEqual([]);
    expect(result.studentCount).toBe(1);
    expect(result.reportId).toBe("r-empty");
    // PR-FIX-3 C5: AI 仍跑（commonIssues/highlights 仍要尝试聚合，即使 weaknessConcepts 空）
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(1);
  });

  it("aggregates: deterministic tag counts + AI for issues + cache write (create path)", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      taskId: "t1",
      title: "Test",
      taskType: "simulation",
    });
    mk(prisma.submission.findMany).mockResolvedValue([
      {
        id: "s1",
        score: 88,
        student: { id: "u1", name: "甲" },
        simulationSubmission: {
          conceptTags: ["CAPM", "资产配置"],
          evaluation: { feedback: "甲的反馈" },
        },
        quizSubmission: null,
        subjectiveSubmission: null,
      },
      {
        id: "s2",
        score: 70,
        student: { id: "u2", name: "乙" },
        simulationSubmission: {
          conceptTags: ["CAPM"],
          evaluation: { feedback: "乙的反馈" },
        },
        quizSubmission: null,
        subjectiveSubmission: null,
      },
      {
        id: "s3",
        score: 60,
        student: { id: "u3", name: "丙" },
        simulationSubmission: {
          conceptTags: ["CAPM"],
          evaluation: { feedback: "丙的反馈" },
        },
        quizSubmission: null,
        subjectiveSubmission: null,
      },
    ]);
    mk(aiGenerateJSON).mockResolvedValue({
      commonIssues: [
        { title: "问题 A", description: "描述 A", studentCount: 2 },
      ],
      highlights: [
        { submissionId: "s1", studentName: "甲", quote: "好答" },
      ],
    });
    mk(prisma.analysisReport.upsert).mockResolvedValue({ id: "r-new" });

    const result = await aggregateInsights("ti1", "teacher1");

    expect(result.studentCount).toBe(3);
    expect(result.reportId).toBe("r-new");
    // Tag counts dedupe by student: CAPM appears in 3 distinct students
    expect(result.commonIssues.weaknessConcepts).toEqual([
      { tag: "CAPM", count: 3 },
      { tag: "资产配置", count: 1 },
    ]);
    expect(result.commonIssues.commonIssues).toHaveLength(1);
    expect(result.commonIssues.highlights).toHaveLength(1);

    // Verifies AI was called with feature 'insights'
    expect(mk(aiGenerateJSON)).toHaveBeenCalledWith(
      "insights",
      "teacher1",
      expect.any(String),
      expect.stringContaining("学生反馈片段"),
      expect.anything()
    );
    // PR-FIX-2 B6: 现在用 upsert 替代 findFirst+create/update
    expect(mk(prisma.analysisReport.upsert)).toHaveBeenCalledTimes(1);
    expect(mk(prisma.analysisReport.create)).not.toHaveBeenCalled();
    expect(mk(prisma.analysisReport.update)).not.toHaveBeenCalled();
  });

  it("updates existing AnalysisReport on re-aggregate (upsert path)", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      taskId: "t1",
      title: "Test",
      taskType: "subjective",
    });
    mk(prisma.submission.findMany).mockResolvedValue([
      {
        id: "s1",
        score: 80,
        student: { id: "u1", name: "甲" },
        simulationSubmission: null,
        quizSubmission: null,
        subjectiveSubmission: {
          conceptTags: ["复利"],
          evaluation: { feedback: "ok" },
        },
      },
    ]);
    mk(aiGenerateJSON).mockResolvedValue({
      commonIssues: [],
      highlights: [],
    });
    mk(prisma.analysisReport.upsert).mockResolvedValue({ id: "r-existing" });

    const result = await aggregateInsights("ti1", "teacher1");

    expect(result.reportId).toBe("r-existing");
    // PR-FIX-2 B6: upsert 一次，DB 决定 insert vs update（取决于 unique constraint hit）
    expect(mk(prisma.analysisReport.upsert)).toHaveBeenCalledTimes(1);
    expect(mk(prisma.analysisReport.create)).not.toHaveBeenCalled();
    expect(mk(prisma.analysisReport.update)).not.toHaveBeenCalled();
  });

  it("counts concept tags from quiz/subjective sources too", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      taskId: "t1",
      title: "Test",
      taskType: "subjective",
    });
    mk(prisma.submission.findMany).mockResolvedValue([
      {
        id: "s1",
        score: 80,
        student: { id: "u1", name: "甲" },
        simulationSubmission: null,
        quizSubmission: null,
        subjectiveSubmission: {
          conceptTags: ["复利", "通胀"],
          evaluation: { feedback: "f1" },
        },
      },
      {
        id: "s2",
        score: 70,
        student: { id: "u2", name: "乙" },
        simulationSubmission: null,
        quizSubmission: { conceptTags: ["通胀"], evaluation: null },
        subjectiveSubmission: null,
      },
    ]);
    mk(aiGenerateJSON).mockResolvedValue({ commonIssues: [], highlights: [] });
    mk(prisma.analysisReport.upsert).mockResolvedValue({ id: "r1" });

    const result = await aggregateInsights("ti1", "t1");
    expect(result.commonIssues.weaknessConcepts).toContainEqual({
      tag: "通胀",
      count: 2,
    });
    expect(result.commonIssues.weaknessConcepts).toContainEqual({
      tag: "复利",
      count: 1,
    });
  });
});
