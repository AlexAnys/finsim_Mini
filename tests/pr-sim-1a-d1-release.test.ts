import { describe, it, expect } from "vitest";
import {
  computeReleasedAtForGrading,
} from "@/lib/services/grading.service";
import {
  deriveAnalysisStatus,
  stripSubmissionForStudent,
} from "@/lib/services/submission.service";

/**
 * PR-SIM-1a · D1 防作弊·"分两步公布"机制纯函数单测
 *
 * 覆盖：
 * - computeReleasedAtForGrading 4 分支
 * - deriveAnalysisStatus 4 分支
 * - stripSubmissionForStudent 剥离规则
 *
 * route handler / service prisma 行为由 QA 真 curl E2E 验证。
 */

describe("PR-SIM-1a D1 · computeReleasedAtForGrading", () => {
  const NOW = new Date("2026-04-26T12:00:00Z");

  it("manual 模式：返回 null（教师手动公布）", () => {
    expect(
      computeReleasedAtForGrading({
        releaseMode: "manual",
        autoReleaseAt: new Date("2026-04-25T00:00:00Z"),
        now: NOW,
      }),
    ).toBeNull();
  });

  it("auto 模式 + autoReleaseAt 已到期：返回 NOW（立即公布）", () => {
    const out = computeReleasedAtForGrading({
      releaseMode: "auto",
      autoReleaseAt: new Date("2026-04-25T00:00:00Z"),
      now: NOW,
    });
    expect(out).toEqual(NOW);
  });

  it("auto 模式 + autoReleaseAt 未到：返回 null（等 cron）", () => {
    const out = computeReleasedAtForGrading({
      releaseMode: "auto",
      autoReleaseAt: new Date("2026-04-27T00:00:00Z"),
      now: NOW,
    });
    expect(out).toBeNull();
  });

  it("auto 模式 + autoReleaseAt 为 null：默认立即公布（教师没设时点）", () => {
    expect(
      computeReleasedAtForGrading({
        releaseMode: "auto",
        autoReleaseAt: null,
        now: NOW,
      }),
    ).toEqual(NOW);
  });

  it("releaseMode 为 null（独立任务）：默认 manual 行为返回 null", () => {
    expect(
      computeReleasedAtForGrading({
        releaseMode: null,
        autoReleaseAt: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("autoReleaseAt 恰好等于 NOW：returns NOW（边界 lte）", () => {
    expect(
      computeReleasedAtForGrading({
        releaseMode: "auto",
        autoReleaseAt: NOW,
        now: NOW,
      }),
    ).toEqual(NOW);
  });
});

describe("PR-SIM-1a D1 · deriveAnalysisStatus", () => {
  it("submitted + null releasedAt → pending", () => {
    expect(deriveAnalysisStatus({ status: "submitted", releasedAt: null })).toBe(
      "pending",
    );
  });

  it("grading + null releasedAt → pending", () => {
    expect(deriveAnalysisStatus({ status: "grading", releasedAt: null })).toBe(
      "pending",
    );
  });

  it("graded + null releasedAt → analyzed_unreleased", () => {
    expect(deriveAnalysisStatus({ status: "graded", releasedAt: null })).toBe(
      "analyzed_unreleased",
    );
  });

  it("graded + releasedAt 非空 → released", () => {
    expect(
      deriveAnalysisStatus({
        status: "graded",
        releasedAt: new Date(),
      }),
    ).toBe("released");
  });

  it("failed + null → pending（视为待重试）", () => {
    expect(deriveAnalysisStatus({ status: "failed", releasedAt: null })).toBe(
      "pending",
    );
  });
});

describe("PR-SIM-1a D1 · stripSubmissionForStudent", () => {
  const baseSimSub = {
    id: "sub-1",
    status: "graded",
    releasedAt: null,
    score: 85,
    maxScore: 100,
    studentId: "stu-1",
    simulationSubmission: {
      id: "ss-1",
      transcript: [{ role: "student", text: "hi" }],
      evaluation: {
        totalScore: 85,
        feedback: "good",
        rubricBreakdown: [{ criterionId: "c1", score: 8 }],
      },
      conceptTags: ["CAPM", "资产配置"],
      assets: { stocks: 50 },
    },
  };

  it("已分析未公布：剥离 score / maxScore / evaluation / conceptTags 但保留 transcript", () => {
    const stripped = stripSubmissionForStudent(baseSimSub as unknown as Record<string, unknown>);
    expect(stripped.score).toBeNull();
    expect(stripped.maxScore).toBeNull();
    const ss = stripped.simulationSubmission as Record<string, unknown>;
    expect(ss.evaluation).toBeNull();
    expect(ss.conceptTags).toEqual([]);
    expect(ss.transcript).toEqual([{ role: "student", text: "hi" }]);
    expect(ss.assets).toEqual({ stocks: 50 });
    expect(stripped.analysisStatus).toBe("analyzed_unreleased");
  });

  it("已公布：返回原始数据 + analysisStatus=released（不剥离）", () => {
    const released = {
      ...baseSimSub,
      releasedAt: new Date("2026-04-26T12:00:00Z"),
    };
    const out = stripSubmissionForStudent(released as unknown as Record<string, unknown>);
    expect(out.score).toBe(85);
    expect(out.maxScore).toBe(100);
    const ss = out.simulationSubmission as Record<string, unknown>;
    expect(ss.evaluation).toEqual(baseSimSub.simulationSubmission.evaluation);
    expect(ss.conceptTags).toEqual(["CAPM", "资产配置"]);
    expect(out.analysisStatus).toBe("released");
  });

  it("pending（status=submitted）：剥离 + analysisStatus=pending", () => {
    const pending = {
      ...baseSimSub,
      status: "submitted",
      score: null,
      maxScore: null,
      simulationSubmission: {
        ...baseSimSub.simulationSubmission,
        evaluation: null,
        conceptTags: [],
      },
    };
    const out = stripSubmissionForStudent(pending as unknown as Record<string, unknown>);
    expect(out.analysisStatus).toBe("pending");
    expect(out.score).toBeNull();
  });

  it("quiz / subjective 类型：同样剥离对应 sub.evaluation/conceptTags", () => {
    const quizSub = {
      id: "sub-q",
      status: "graded",
      releasedAt: null,
      score: 90,
      maxScore: 100,
      quizSubmission: {
        answers: [{ questionId: "q1", selectedOptionIds: ["a"] }],
        evaluation: { totalScore: 90, quizBreakdown: [] },
        conceptTags: ["概念1"],
      },
    };
    const out = stripSubmissionForStudent(quizSub as unknown as Record<string, unknown>);
    expect(out.score).toBeNull();
    const qs = out.quizSubmission as Record<string, unknown>;
    expect(qs.evaluation).toBeNull();
    expect(qs.conceptTags).toEqual([]);
    // 学生自己提交的 answers 仍可见
    expect(qs.answers).toEqual([{ questionId: "q1", selectedOptionIds: ["a"] }]);
  });

  it("不动入参对象（immutable）", () => {
    const orig = JSON.parse(JSON.stringify(baseSimSub));
    stripSubmissionForStudent(baseSimSub as unknown as Record<string, unknown>);
    expect(baseSimSub).toEqual(orig);
  });
});
