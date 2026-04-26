import { describe, it, expect } from "vitest";
import {
  buildHistogram,
  buildScatter,
  computeKPIs,
  formatMinutes,
  formatRate,
  formatScore,
} from "@/components/instance-detail/analytics-utils";
import type { NormalizedSubmission } from "@/components/instance-detail/submissions-utils";

function row(overrides: Partial<NormalizedSubmission>): NormalizedSubmission {
  return {
    id: "s",
    studentId: "u",
    studentName: "X",
    status: "graded",
    score: 80,
    maxScore: 100,
    aiScore: 80,
    submittedAt: "2026-04-25T10:00:00Z",
    gradedAt: "2026-04-25T10:30:00Z",
    durationSeconds: 1200,
    taskType: "quiz",
    evaluation: null,
    attachments: [],
    releasedAt: null,
    analysisStatus: "analyzed_unreleased",
    ...overrides,
  };
}

describe("computeKPIs", () => {
  it("returns all-null KPIs for empty/non-graded set", () => {
    const k = computeKPIs([
      row({ id: "1", status: "submitted", score: null }),
      row({ id: "2", status: "grading", score: null }),
    ]);
    expect(k).toEqual({
      avgScore: null,
      medianScore: null,
      passRate: null,
      avgDurationSeconds: null,
      gradedCount: 0,
    });
  });

  it("computes avg/median over graded only", () => {
    const k = computeKPIs([
      row({ id: "1", score: 90 }),
      row({ id: "2", score: 70 }),
      row({ id: "3", score: 80 }),
      row({ id: "4", status: "submitted", score: null }),
    ]);
    expect(k.gradedCount).toBe(3);
    expect(k.avgScore).toBe(80);
    expect(k.medianScore).toBe(80);
  });

  it("median for even count averages the two middle values", () => {
    const k = computeKPIs([
      row({ id: "1", score: 60 }),
      row({ id: "2", score: 80 }),
      row({ id: "3", score: 70 }),
      row({ id: "4", score: 90 }),
    ]);
    expect(k.medianScore).toBe(75);
  });

  it("passRate counts students with score/max ≥ 0.6", () => {
    const k = computeKPIs([
      row({ id: "1", score: 60, maxScore: 100 }),
      row({ id: "2", score: 30, maxScore: 100 }),
      row({ id: "3", score: 80, maxScore: 100 }),
      row({ id: "4", score: 59, maxScore: 100 }),
    ]);
    expect(k.passRate).toBeCloseTo(0.5);
  });

  it("avgDurationSeconds averages graded with durationSeconds > 0; ignores nulls", () => {
    const k = computeKPIs([
      row({ id: "1", durationSeconds: 1200 }),
      row({ id: "2", durationSeconds: 1800 }),
      row({ id: "3", durationSeconds: null }),
    ]);
    expect(k.avgDurationSeconds).toBe(1500);
  });

  it("rounds avgScore to 1 decimal", () => {
    const k = computeKPIs([
      row({ id: "1", score: 81 }),
      row({ id: "2", score: 82 }),
      row({ id: "3", score: 83 }),
      row({ id: "4", score: 80 }),
    ]);
    expect(k.avgScore).toBe(81.5);
  });
});

describe("buildHistogram", () => {
  it("creates 6 buckets with correct labels", () => {
    const buckets = buildHistogram([]);
    expect(buckets.map((b) => b.label)).toEqual([
      "<40",
      "40-55",
      "55-70",
      "70-80",
      "80-90",
      "90+",
    ]);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("normalizes score to maxScore (out of 100 scale)", () => {
    // score=15 / max=20 → 75% → bucket 70-80
    const buckets = buildHistogram([
      row({ id: "1", score: 15, maxScore: 20 }),
    ]);
    const b = buckets.find((x) => x.label === "70-80")!;
    expect(b.count).toBe(1);
  });

  it("places 90+ correctly at 100", () => {
    const buckets = buildHistogram([
      row({ id: "1", score: 100, maxScore: 100 }),
    ]);
    expect(buckets.find((b) => b.label === "90+")!.count).toBe(1);
  });

  it("places <40 correctly", () => {
    const buckets = buildHistogram([
      row({ id: "1", score: 10, maxScore: 100 }),
    ]);
    expect(buckets.find((b) => b.label === "<40")!.count).toBe(1);
  });

  it("ignores non-graded rows", () => {
    const buckets = buildHistogram([
      row({ id: "1", score: 80, status: "graded" }),
      row({ id: "2", score: null, status: "submitted" }),
      row({ id: "3", score: 90, status: "grading" }),
    ]);
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
  });

  it("ignores rows with maxScore <= 0 (defensive)", () => {
    const buckets = buildHistogram([row({ id: "1", score: 5, maxScore: 0 })]);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });
});

describe("buildScatter", () => {
  it("returns durationMinutes + normalized score for graded rows with duration", () => {
    const points = buildScatter([
      row({ id: "1", durationSeconds: 1200, score: 80, maxScore: 100 }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0].durationMinutes).toBe(20);
    expect(points[0].score).toBe(80);
  });

  it("normalizes score when maxScore != 100", () => {
    const points = buildScatter([
      row({ id: "1", durationSeconds: 600, score: 8, maxScore: 10 }),
    ]);
    expect(points[0].score).toBe(80);
  });

  it("filters out rows without duration", () => {
    const points = buildScatter([
      row({ id: "1", durationSeconds: null }),
      row({ id: "2", durationSeconds: 0 }),
      row({ id: "3", durationSeconds: 600 }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0].submissionId).toBe("3");
  });

  it("filters out non-graded rows", () => {
    const points = buildScatter([
      row({ id: "1", status: "submitted", score: null, durationSeconds: 600 }),
      row({ id: "2", status: "graded", score: 80, durationSeconds: 600 }),
    ]);
    expect(points).toHaveLength(1);
  });
});

describe("formatters", () => {
  it("formatMinutes converts seconds to rounded minutes with prime", () => {
    expect(formatMinutes(null)).toBe("—");
    expect(formatMinutes(60)).toBe("1'");
    expect(formatMinutes(125)).toBe("2'");
    expect(formatMinutes(0)).toBe("0'");
  });

  it("formatRate converts 0-1 to %", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0.625)).toBe("63%");
    expect(formatRate(1)).toBe("100%");
  });

  it("formatScore handles null", () => {
    expect(formatScore(null)).toBe("—");
    expect(formatScore(80)).toBe("80");
    expect(formatScore(81.5)).toBe("81.5");
  });
});
