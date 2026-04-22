import { describe, it, expect } from "vitest";
import { buildStudentRanking } from "@/components/course/course-analytics-tab";

describe("buildStudentRanking (B8 fix)", () => {
  it("excludes students whose only submission is not graded", async () => {
    const result = buildStudentRanking([
      {
        subs: [
          { student: { id: "s1", name: "Alice" }, status: "submitted", score: null },
        ],
      },
    ]);
    expect(result).toHaveLength(0);
  });

  it("keeps students with at least one graded submission", async () => {
    const result = buildStudentRanking([
      {
        subs: [
          { student: { id: "s1", name: "Alice" }, status: "graded", score: 85 },
          { student: { id: "s2", name: "Bob" }, status: "submitted", score: null },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe("s1");
    expect(result[0].avgScore).toBe(85);
    expect(result[0].gradedCount).toBe(1);
  });

  it("does not rank a real 0-score student alongside an ungraded student (the core B8 bug)", async () => {
    const result = buildStudentRanking([
      {
        subs: [
          { student: { id: "s-zero", name: "ZeroStudent" }, status: "graded", score: 0 },
          { student: { id: "s-ungraded", name: "Ungraded" }, status: "submitted", score: null },
          { student: { id: "s-high", name: "HighScore" }, status: "graded", score: 90 },
        ],
      },
    ]);
    expect(result.map((r) => r.studentId)).toEqual(["s-high", "s-zero"]);
    expect(result.find((r) => r.studentId === "s-ungraded")).toBeUndefined();
  });

  it("sorts descending by avgScore", async () => {
    const result = buildStudentRanking([
      {
        subs: [
          { student: { id: "a", name: "A" }, status: "graded", score: 70 },
          { student: { id: "b", name: "B" }, status: "graded", score: 95 },
          { student: { id: "c", name: "C" }, status: "graded", score: 80 },
        ],
      },
    ]);
    expect(result.map((r) => r.studentId)).toEqual(["b", "c", "a"]);
  });

  it("aggregates across multiple instances and averages correctly", async () => {
    const result = buildStudentRanking([
      {
        subs: [
          { student: { id: "s1", name: "Alice" }, status: "graded", score: 80 },
        ],
      },
      {
        subs: [
          { student: { id: "s1", name: "Alice" }, status: "graded", score: 100 },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].gradedCount).toBe(2);
    expect(result[0].submissionCount).toBe(2);
    expect(result[0].avgScore).toBe(90);
  });
});
