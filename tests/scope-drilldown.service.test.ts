import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskInstance: { findMany: vi.fn() },
    submission: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    studentGroup: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/analytics-v2.service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/analytics-v2.service")>(
    "@/lib/services/analytics-v2.service",
  );
  return {
    ...actual,
    getAnalyticsV2Diagnosis: vi.fn(),
  };
});

import { prisma } from "@/lib/db/prisma";
import { getAnalyticsV2Diagnosis } from "@/lib/services/analytics-v2.service";
import {
  getMissingStudents,
  getRiskChapters,
  getRiskStudents,
  getLowScorers,
  getPendingReleaseList,
} from "@/lib/services/scope-drilldown.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function diagnosisStub(overrides: {
  chapterDiagnostics?: Array<{
    chapterId: string | null;
    title: string;
    completionRate: number | null;
    avgNormalizedScore: number | null;
    instanceCount: number;
  }>;
  studentInterventions?: Array<{
    studentId: string;
    studentName: string;
    instanceId: string;
    instanceTitle: string;
    classId: string;
    className: string;
    reason: "not_submitted" | "low_score" | "declining";
    selectedScore: number | null;
  }>;
  instanceDiagnostics?: Array<{
    instanceId: string;
    title: string;
    classId: string;
    className: string;
    chapterId: string | null;
  }>;
}) {
  return {
    chapterDiagnostics: overrides.chapterDiagnostics ?? [],
    studentInterventions: overrides.studentInterventions ?? [],
    instanceDiagnostics: overrides.instanceDiagnostics ?? [],
  };
}

describe("getRiskChapters threshold semantics", () => {
  it("includes chapters with completion below 0.6 (strict <)", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(
      diagnosisStub({
        chapterDiagnostics: [
          { chapterId: "ch-low", title: "低完成率章节", completionRate: 0.59, avgNormalizedScore: 90, instanceCount: 1 },
        ],
      }),
    );
    const result = await getRiskChapters({ courseId: "c-1" });
    expect(result.length).toBe(1);
    expect(result[0].chapterId).toBe("ch-low");
  });

  it("excludes chapters with exactly 0.6 completion (per strict <)", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(
      diagnosisStub({
        chapterDiagnostics: [
          { chapterId: "ch-edge", title: "临界章节", completionRate: 0.6, avgNormalizedScore: 90, instanceCount: 1 },
        ],
      }),
    );
    const result = await getRiskChapters({ courseId: "c-1" });
    expect(result.length).toBe(0);
  });

  it("includes chapters with avgNormalizedScore below 60", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(
      diagnosisStub({
        chapterDiagnostics: [
          { chapterId: "ch-low-score", title: "低均分章节", completionRate: 0.95, avgNormalizedScore: 59.9, instanceCount: 1 },
        ],
      }),
    );
    const result = await getRiskChapters({ courseId: "c-1" });
    expect(result.length).toBe(1);
  });

  it("excludes chapters with both metrics above thresholds", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(
      diagnosisStub({
        chapterDiagnostics: [
          { chapterId: "ch-ok", title: "正常章节", completionRate: 0.95, avgNormalizedScore: 80, instanceCount: 1 },
        ],
      }),
    );
    const result = await getRiskChapters({ courseId: "c-1" });
    expect(result.length).toBe(0);
  });
});

describe("getRiskStudents reason coverage", () => {
  it("includes students from all three reasons (not_submitted/low_score/declining)", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(
      diagnosisStub({
        studentInterventions: [
          { studentId: "u1", studentName: "Alice", instanceId: "i1", instanceTitle: "T1", classId: "c1", className: "A 班", reason: "not_submitted", selectedScore: null },
          { studentId: "u2", studentName: "Bob", instanceId: "i1", instanceTitle: "T1", classId: "c1", className: "A 班", reason: "low_score", selectedScore: 40 },
          { studentId: "u3", studentName: "Carl", instanceId: "i1", instanceTitle: "T1", classId: "c1", className: "A 班", reason: "declining", selectedScore: 50 },
        ],
      }),
    );
    const result = await getRiskStudents({ courseId: "c-1" });
    expect(result.length).toBe(3);
    const reasons = result.map((r) => r.reason).sort();
    expect(reasons).toEqual(["declining", "low_score", "not_submitted"]);
  });

  it("dedupes by studentId across multiple interventions", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(
      diagnosisStub({
        studentInterventions: [
          { studentId: "u1", studentName: "Alice", instanceId: "i1", instanceTitle: "T1", classId: "c1", className: "A 班", reason: "not_submitted", selectedScore: null },
          { studentId: "u1", studentName: "Alice", instanceId: "i2", instanceTitle: "T2", classId: "c1", className: "A 班", reason: "low_score", selectedScore: 30 },
        ],
      }),
    );
    const result = await getRiskStudents({ courseId: "c-1" });
    expect(result.length).toBe(1);
    expect(result[0].taskInstances.length).toBe(2);
  });

  it("orders results by reason severity (not_submitted < low_score < declining)", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(
      diagnosisStub({
        studentInterventions: [
          { studentId: "u3", studentName: "Carl", instanceId: "i3", instanceTitle: "T3", classId: "c1", className: "A 班", reason: "declining", selectedScore: 50 },
          { studentId: "u2", studentName: "Bob", instanceId: "i2", instanceTitle: "T2", classId: "c1", className: "A 班", reason: "low_score", selectedScore: 40 },
          { studentId: "u1", studentName: "Alice", instanceId: "i1", instanceTitle: "T1", classId: "c1", className: "A 班", reason: "not_submitted", selectedScore: null },
        ],
      }),
    );
    const result = await getRiskStudents({ courseId: "c-1" });
    expect(result.map((r) => r.studentId)).toEqual(["u1", "u2", "u3"]);
  });
});

describe("getMissingStudents", () => {
  it("returns empty when no instances", async () => {
    mk(prisma.taskInstance.findMany).mockResolvedValue([]);
    const result = await getMissingStudents({ courseId: "c-1" });
    expect(result).toEqual([]);
  });

  it("includes assigned class students who have not submitted", async () => {
    mk(prisma.taskInstance.findMany).mockResolvedValue([
      {
        id: "inst-1",
        title: "测验",
        classId: "class-A",
        groupIds: [],
        class: { id: "class-A", name: "A 班" },
        submissions: [{ studentId: "u1" }],
      },
    ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "u1", name: "Alice", classId: "class-A" },
      { id: "u2", name: "Bob", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([]);
    const result = await getMissingStudents({ courseId: "c-1" });
    expect(result.length).toBe(1);
    expect(result[0].studentId).toBe("u2");
  });
});

describe("getLowScorers / getPendingReleaseList smoke", () => {
  it("getLowScorers returns empty when no graded submissions", async () => {
    mk(getAnalyticsV2Diagnosis).mockResolvedValue(diagnosisStub({}));
    mk(prisma.submission.findMany).mockResolvedValue([]);
    const result = await getLowScorers({ courseId: "c-1" });
    expect(result).toEqual([]);
  });

  it("getPendingReleaseList returns empty when no pending submissions", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([]);
    const result = await getPendingReleaseList({ courseId: "c-1" });
    expect(result).toEqual([]);
  });
});
