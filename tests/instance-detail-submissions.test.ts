import { describe, it, expect } from "vitest";
import {
  filterSubmissions,
  formatDuration,
  normalizeSubmission,
  scoreDiff,
  sortSubmissions,
  statusCounts,
  type NormalizedSubmission,
} from "@/components/instance-detail/submissions-utils";

function makeRow(overrides: Partial<NormalizedSubmission> = {}): NormalizedSubmission {
  return {
    id: "s1",
    studentId: "u1",
    studentName: "李思远",
    status: "graded",
    score: 92,
    maxScore: 100,
    aiScore: 92,
    submittedAt: "2026-04-07T13:14:00Z",
    gradedAt: "2026-04-07T15:00:00Z",
    durationSeconds: 1440,
    taskType: "simulation",
    evaluation: null,
    attachments: [],
    ...overrides,
  };
}

describe("normalizeSubmission", () => {
  it("extracts evaluation from simulation submission first", () => {
    const out = normalizeSubmission({
      id: "s1",
      status: "graded",
      score: 80,
      maxScore: 100,
      submittedAt: "2026-04-07T10:00:00Z",
      gradedAt: null,
      taskType: "simulation",
      student: { id: "u1", name: "甲" },
      simulationSubmission: {
        evaluation: { totalScore: 88, feedback: "ok", confidence: 0.7 },
      },
      quizSubmission: null,
      subjectiveSubmission: null,
    });
    expect(out.aiScore).toBe(88);
    expect(out.evaluation?.feedback).toBe("ok");
    expect(out.evaluation?.confidence).toBe(0.7);
  });

  it("falls back to quiz then subjective", () => {
    const out = normalizeSubmission({
      id: "s1",
      status: "graded",
      score: null,
      maxScore: null,
      submittedAt: "2026-04-07T10:00:00Z",
      gradedAt: null,
      taskType: "subjective",
      student: { id: "u1", name: "甲" },
      simulationSubmission: null,
      quizSubmission: null,
      subjectiveSubmission: {
        evaluation: { totalScore: 70 },
        attachments: [
          { id: "a1", fileName: "x.pdf", filePath: "/f", fileSize: 100, contentType: "application/pdf" },
        ],
      },
    });
    expect(out.aiScore).toBe(70);
    expect(out.attachments?.[0].fileName).toBe("x.pdf");
  });

  it("converts decimal score strings to numbers", () => {
    const out = normalizeSubmission({
      id: "s1",
      status: "graded",
      score: "84.5" as unknown as number,
      maxScore: "100" as unknown as number,
      submittedAt: "2026-04-07T10:00:00Z",
      gradedAt: null,
      taskType: "simulation",
      student: { id: "u1", name: "甲" },
      simulationSubmission: null,
      quizSubmission: null,
      subjectiveSubmission: null,
    });
    expect(out.score).toBe(84.5);
    expect(out.maxScore).toBe(100);
  });

  it("returns null aiScore when no evaluation present", () => {
    const out = normalizeSubmission({
      id: "s1",
      status: "submitted",
      score: null,
      maxScore: null,
      submittedAt: "2026-04-07T10:00:00Z",
      gradedAt: null,
      taskType: "simulation",
      student: { id: "u1", name: "甲" },
      simulationSubmission: null,
      quizSubmission: null,
      subjectiveSubmission: null,
    });
    expect(out.aiScore).toBeNull();
    expect(out.evaluation).toBeNull();
  });
});

describe("filterSubmissions", () => {
  const rows = [
    makeRow({ id: "1", studentName: "张三", status: "graded" }),
    makeRow({ id: "2", studentName: "李四", status: "submitted" }),
    makeRow({ id: "3", studentName: "王五", status: "grading" }),
    makeRow({ id: "4", studentName: "赵六", status: "graded" }),
  ];

  it("returns all when filter=all and query empty", () => {
    expect(filterSubmissions(rows, "all", "").length).toBe(4);
  });

  it("filters by status", () => {
    expect(filterSubmissions(rows, "graded", "").length).toBe(2);
    expect(filterSubmissions(rows, "grading", "").length).toBe(1);
    expect(filterSubmissions(rows, "submitted", "").length).toBe(1);
  });

  it("filters by name (case-insensitive substring)", () => {
    expect(filterSubmissions(rows, "all", "张").length).toBe(1);
    expect(filterSubmissions(rows, "all", "  王  ").length).toBe(1);
    expect(filterSubmissions(rows, "all", "missing").length).toBe(0);
  });

  it("AND combines status + query", () => {
    expect(filterSubmissions(rows, "graded", "张").length).toBe(1);
    expect(filterSubmissions(rows, "graded", "李").length).toBe(0);
  });
});

describe("sortSubmissions", () => {
  const rows = [
    makeRow({ id: "1", studentName: "B", score: 50, submittedAt: "2026-04-07T01:00:00Z" }),
    makeRow({ id: "2", studentName: "A", score: 90, submittedAt: "2026-04-07T03:00:00Z" }),
    makeRow({ id: "3", studentName: "C", score: null, submittedAt: "2026-04-07T02:00:00Z" }),
  ];

  it("score-desc puts highest first; null last", () => {
    const out = sortSubmissions(rows, "score-desc");
    expect(out.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("score-asc puts lowest first; null last", () => {
    const out = sortSubmissions(rows, "score-asc");
    expect(out.map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("time-desc puts newest first", () => {
    const out = sortSubmissions(rows, "time-desc");
    expect(out.map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("name sorts alphabetically (zh-CN locale)", () => {
    const out = sortSubmissions(rows, "name");
    expect(out.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("doesn't mutate input", () => {
    const before = rows.map((r) => r.id);
    sortSubmissions(rows, "score-desc");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("statusCounts", () => {
  it("counts each status", () => {
    const c = statusCounts([
      makeRow({ status: "graded" }),
      makeRow({ status: "graded" }),
      makeRow({ status: "grading" }),
      makeRow({ status: "submitted" }),
      makeRow({ status: "failed" }),
    ]);
    expect(c.all).toBe(5);
    expect(c.graded).toBe(2);
    expect(c.grading).toBe(1);
    expect(c.submitted).toBe(1);
  });

  it("zero-fills counts on empty input", () => {
    const c = statusCounts([]);
    expect(c.all).toBe(0);
    expect(c.graded).toBe(0);
    expect(c.grading).toBe(0);
    expect(c.submitted).toBe(0);
  });
});

describe("formatDuration", () => {
  it("returns '-' for null/invalid", () => {
    expect(formatDuration(null)).toBe("-");
    expect(formatDuration(-1)).toBe("-");
  });

  it("formats seconds < 60s as '<1 分钟'", () => {
    expect(formatDuration(30)).toBe("<1 分钟");
  });

  it("formats minutes", () => {
    expect(formatDuration(120)).toBe("2 分钟");
    expect(formatDuration(59 * 60)).toBe("59 分钟");
  });

  it("formats hours", () => {
    expect(formatDuration(60 * 60)).toBe("1 小时");
    expect(formatDuration(90 * 60)).toBe("1h30m");
  });
});

describe("scoreDiff", () => {
  it("returns null if either is null", () => {
    expect(scoreDiff(null, 80)).toBeNull();
    expect(scoreDiff(80, null)).toBeNull();
    expect(scoreDiff(null, null)).toBeNull();
  });

  it("computes diff teacher - ai", () => {
    expect(scoreDiff(85, 80)).toBe(5);
    expect(scoreDiff(70, 80)).toBe(-10);
    expect(scoreDiff(80, 80)).toBe(0);
  });
});
