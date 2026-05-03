import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    analysisReport: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    taskInstance: { findMany: vi.fn() },
    submission: { findMany: vi.fn() },
    studyBuddySummary: { findMany: vi.fn() },
    studyBuddyPost: { findMany: vi.fn() },
    scoringCriterion: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  computeScopeHash,
  getScopeSimulationInsights,
  getScopeStudyBuddySummary,
  type ScopeKey,
} from "@/lib/services/scope-insights.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mk(prisma.analysisReport.findFirst).mockResolvedValue(null);
  mk(prisma.analysisReport.create).mockResolvedValue({ id: "ar-1" });
  mk(prisma.analysisReport.update).mockResolvedValue({ id: "ar-1" });
  mk(prisma.scoringCriterion.findMany).mockResolvedValue([]);
});

describe("computeScopeHash", () => {
  it("produces a stable hash for the same scope regardless of property order", () => {
    const a: ScopeKey = {
      courseId: "c-1",
      classIds: ["x", "y"],
      taskType: "simulation",
    };
    const b: ScopeKey = {
      taskType: "simulation",
      classIds: ["x", "y"],
      courseId: "c-1",
    };
    expect(computeScopeHash(a)).toBe(computeScopeHash(b));
  });

  it("normalizes classIds order before hashing", () => {
    const sorted = computeScopeHash({ courseId: "c-1", classIds: ["a", "b", "c"] });
    const reversed = computeScopeHash({ courseId: "c-1", classIds: ["c", "a", "b"] });
    expect(sorted).toBe(reversed);
  });

  it("produces different hashes for different courses", () => {
    expect(computeScopeHash({ courseId: "c-1" })).not.toBe(
      computeScopeHash({ courseId: "c-2" }),
    );
  });

  it("includes optional filters in the hash", () => {
    expect(computeScopeHash({ courseId: "c-1" })).not.toBe(
      computeScopeHash({ courseId: "c-1", chapterId: "ch-1" }),
    );
  });
});

describe("getScopeSimulationInsights — heuristic highlights", () => {
  it("limits highlights to top-N with per-task cap", async () => {
    mk(prisma.taskInstance.findMany).mockResolvedValue([
      { id: "inst-1", title: "客户对话 A" },
      { id: "inst-2", title: "客户对话 B" },
    ]);
    mk(prisma.submission.findMany).mockResolvedValue([
      buildGradedSubmission({ id: "s1", instId: "inst-1", studentId: "u1", studentName: "Alice", score: 95 }),
      buildGradedSubmission({ id: "s2", instId: "inst-1", studentId: "u2", studentName: "Bob", score: 92 }),
      buildGradedSubmission({ id: "s3", instId: "inst-1", studentId: "u3", studentName: "Carl", score: 90 }),
      buildGradedSubmission({ id: "s4", instId: "inst-2", studentId: "u4", studentName: "Dora", score: 88 }),
      buildGradedSubmission({ id: "s5", instId: "inst-2", studentId: "u5", studentName: "Erin", score: 80 }),
      buildGradedSubmission({ id: "s6", instId: "inst-2", studentId: "u6", studentName: "Finn", score: 75 }),
    ]);
    mk(aiGenerateJSON).mockResolvedValue({ commonIssues: [] });

    const result = await getScopeSimulationInsights(
      { courseId: "course-1" },
      { teacherId: "t-1" },
    );

    expect(result.highlights.length).toBeLessThanOrEqual(4);
    const perTaskCount = new Map<string, number>();
    for (const h of result.highlights) {
      perTaskCount.set(h.taskInstanceId, (perTaskCount.get(h.taskInstanceId) ?? 0) + 1);
    }
    for (const count of perTaskCount.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
    expect(result.highlights[0].normalizedScore).toBe(95);
  });

  it("returns empty arrays when no graded submissions exist", async () => {
    mk(prisma.taskInstance.findMany).mockResolvedValue([{ id: "inst-1", title: "x" }]);
    mk(prisma.submission.findMany).mockResolvedValue([]);

    const result = await getScopeSimulationInsights({ courseId: "course-1" });

    expect(result.highlights).toEqual([]);
    expect(result.commonIssues).toEqual([]);
    expect(result.source).toBe("fresh");
  });
});

describe("getScopeSimulationInsights — LLM fallback", () => {
  it("returns fallback commonIssues when AI throws", async () => {
    mk(prisma.taskInstance.findMany).mockResolvedValue([{ id: "inst-1", title: "客户对话" }]);
    mk(prisma.submission.findMany).mockResolvedValue([
      buildGradedSubmission({
        id: "s1",
        instId: "inst-1",
        studentId: "u1",
        studentName: "Alice",
        score: 30,
        rubricBreakdown: [
          { criterionId: "crit-1", criterionName: "需求澄清", score: 1, maxScore: 5, comment: "" },
          { criterionId: "crit-2", criterionName: "风险解释", score: 2, maxScore: 5, comment: "" },
        ],
      }),
    ]);
    mk(aiGenerateJSON).mockRejectedValue(new Error("LLM_DOWN"));

    const result = await getScopeSimulationInsights(
      { courseId: "course-1" },
      { teacherId: "t-1" },
    );

    expect(result.source).toBe("fallback");
    expect(result.commonIssues.length).toBeGreaterThan(0);
    expect(result.notice).toBeTruthy();
  });

  it("returns cache hit on second invocation", async () => {
    const cached = {
      generatedAt: new Date().toISOString(),
      highlights: [],
      commonIssues: [],
      source: "fresh",
      notice: null,
    };
    mk(prisma.analysisReport.findFirst).mockResolvedValue({
      scopeSummary: cached,
      createdAt: new Date(),
    });

    const result = await getScopeSimulationInsights({ courseId: "course-1" });

    expect(result.source).toBe("cache");
    expect(prisma.analysisReport.create).not.toHaveBeenCalled();
  });
});

describe("getScopeStudyBuddySummary", () => {
  it("groups topQuestions by section and limits to top-5", async () => {
    mk(prisma.taskInstance.findMany).mockResolvedValue([
      {
        taskId: "task-1",
        chapterId: "ch-1",
        sectionId: "sec-1",
        chapter: { id: "ch-1", title: "理财基础", order: 1 },
        section: { id: "sec-1", title: "现金流", order: 1 },
      },
    ]);
    mk(prisma.studyBuddySummary.findMany).mockResolvedValue([
      {
        taskId: "task-1",
        topQuestions: [
          { question: "Q1", count: 5 },
          { question: "Q2", count: 4 },
          { question: "Q3", count: 3 },
          { question: "Q4", count: 2 },
          { question: "Q5", count: 1 },
          { question: "Q6", count: 0 },
        ],
      },
    ]);
    mk(prisma.studyBuddyPost.findMany).mockResolvedValue([]);

    const result = await getScopeStudyBuddySummary({ courseId: "course-1" });

    expect(result.bySection.length).toBe(1);
    expect(result.bySection[0].topQuestions.length).toBeLessThanOrEqual(5);
    expect(result.bySection[0].sectionLabel).toContain("理财基础");
  });

  it("returns empty bySection when there are no instances in scope", async () => {
    mk(prisma.taskInstance.findMany).mockResolvedValue([]);

    const result = await getScopeStudyBuddySummary({ courseId: "course-x" });
    expect(result.bySection).toEqual([]);
  });
});

interface BuildGradedOpts {
  id: string;
  instId: string;
  studentId: string;
  studentName: string;
  score: number;
  rubricBreakdown?: Array<{
    criterionId: string;
    criterionName: string;
    score: number;
    maxScore: number;
    comment?: string;
  }>;
}

function buildGradedSubmission(opts: BuildGradedOpts) {
  return {
    id: opts.id,
    studentId: opts.studentId,
    taskInstanceId: opts.instId,
    score: opts.score,
    maxScore: 100,
    student: { id: opts.studentId, name: opts.studentName },
    simulationSubmission: {
      transcript: [
        { role: "assistant", text: "我希望产品收益率高一些。" },
        {
          role: "student",
          text: "我先了解一下您的现金流情况，再给出风险与配置的建议。这样可以避免短期流动性紧张。",
        },
      ],
      evaluation: opts.rubricBreakdown
        ? { rubricBreakdown: opts.rubricBreakdown }
        : null,
    },
  };
}
