import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    taskInstance: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    studentGroup: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  buildStudentInstanceAttempts,
  extractWeaknessSignals,
  getAnalyticsV2Diagnosis,
  normalizeScore,
  selectSubmissionForScore,
} from "@/lib/services/analytics-v2.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const course = {
  id: "course-1",
  courseTitle: "金融模拟",
  classId: "class-A",
  class: { id: "class-A", name: "A 班" },
  classes: [{ class: { id: "class-A", name: "A 班" } }],
  chapters: [
    {
      id: "chapter-1",
      title: "资产配置",
      order: 1,
      sections: [{ id: "section-1", title: "风险预算", chapterId: "chapter-1", order: 1 }],
    },
  ],
};

const optionInstance = {
  id: "inst-1",
  title: "课后测验",
  taskType: "quiz" as const,
  classId: "class-A",
  chapterId: "chapter-1",
  sectionId: "section-1",
  class: { id: "class-A", name: "A 班" },
};

function submission(overrides: {
  id: string;
  studentId: string;
  status: string;
  score?: number | null;
  maxScore?: number | null;
  submittedAt: string;
}) {
  return {
    id: overrides.id,
    studentId: overrides.studentId,
    taskType: "quiz" as const,
    status: overrides.status,
    score: overrides.score ?? null,
    maxScore: overrides.maxScore ?? null,
    submittedAt: new Date(overrides.submittedAt),
    student: { id: overrides.studentId, name: overrides.studentId.toUpperCase() },
    simulationSubmission: null,
    quizSubmission: {
      evaluation: null,
      conceptTags: [],
      durationSeconds: null,
    },
    subjectiveSubmission: null,
  };
}

function instance(overrides: {
  id?: string;
  classId?: string;
  groupIds?: string[];
  submissions?: ReturnType<typeof submission>[];
}) {
  const classId = overrides.classId ?? "class-A";
  return {
    id: overrides.id ?? "inst-1",
    title: "课后测验",
    taskId: "task-1",
    taskType: "quiz" as const,
    classId,
    groupIds: overrides.groupIds ?? [],
    chapterId: "chapter-1",
    sectionId: "section-1",
    class: { id: classId, name: classId === "class-A" ? "A 班" : "B 班" },
    chapter: { id: "chapter-1", title: "资产配置", order: 1 },
    section: { id: "section-1", title: "风险预算", chapterId: "chapter-1", order: 1 },
    submissions: overrides.submissions ?? [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analytics-v2 score helpers", () => {
  it("normalizes score by maxScore", () => {
    expect(normalizeScore(8, 10)).toBe(80);
    expect(normalizeScore(15, 20)).toBe(75);
    expect(normalizeScore(5, 0)).toBeNull();
  });

  it("selects latest/best/first scored submission and computes attempts", () => {
    const attempts = [
      { id: "a1", studentId: "s1", status: "graded", score: 5, maxScore: 10, submittedAt: "2026-01-01T00:00:00Z" },
      { id: "a2", studentId: "s1", status: "graded", score: 9, maxScore: 10, submittedAt: "2026-01-02T00:00:00Z" },
      { id: "a3", studentId: "s1", status: "graded", score: 7, maxScore: 10, submittedAt: "2026-01-03T00:00:00Z" },
    ];

    expect(selectSubmissionForScore(attempts, "latest")?.id).toBe("a3");
    expect(selectSubmissionForScore(attempts, "best")?.id).toBe("a2");
    expect(selectSubmissionForScore(attempts, "first")?.id).toBe("a1");

    const [metrics] = buildStudentInstanceAttempts(attempts, "latest");
    expect(metrics).toMatchObject({
      studentId: "s1",
      attemptCount: 3,
      selectedScore: 70,
      firstScore: 50,
      latestScore: 70,
      bestScore: 90,
      improvement: 20,
    });
  });
});

describe("analytics-v2 weakness gating", () => {
  it("does not treat conceptTags alone as weakness", () => {
    const signals = extractWeaknessSignals({
      score: 95,
      maxScore: 100,
      quizSubmission: {
        conceptTags: ["CAPM"],
        evaluation: { feedback: "表现良好" },
      },
    });

    expect(signals).toEqual([]);
  });

  it("does not treat negated praise feedback as weakness evidence", () => {
    const signals = extractWeaknessSignals({
      score: 95,
      maxScore: 100,
      quizSubmission: {
        conceptTags: ["CAPM"],
        evaluation: { feedback: "没有错误，表现良好" },
      },
    });

    expect(signals).toEqual([]);
  });

  it("counts conceptTags only when low score, wrong answers, low rubric, or explicit feedback exists", () => {
    expect(
      extractWeaknessSignals({
        score: 40,
        maxScore: 100,
        quizSubmission: { conceptTags: ["CAPM"], evaluation: { feedback: "ok" } },
      })[0],
    ).toMatchObject({ tag: "CAPM", reason: "low_score" });

    expect(
      extractWeaknessSignals({
        score: 90,
        maxScore: 100,
        quizSubmission: {
          conceptTags: ["资产配置"],
          evaluation: { quizBreakdown: [{ questionId: "q1", correct: false, score: 0, maxScore: 5 }] },
        },
      })[0],
    ).toMatchObject({ tag: "资产配置", reason: "wrong_question" });

    expect(
      extractWeaknessSignals({
        score: 90,
        maxScore: 100,
        subjectiveSubmission: {
          conceptTags: ["风险预算"],
          evaluation: { rubricBreakdown: [{ criterionId: "r1", score: 1, maxScore: 5 }] },
        },
      })[0],
    ).toMatchObject({ tag: "风险预算", reason: "low_rubric" });

    expect(
      extractWeaknessSignals({
        score: 90,
        maxScore: 100,
        simulationSubmission: {
          conceptTags: ["久期"],
          evaluation: { feedback: "对久期概念理解不足，需要改进" },
        },
      })[0],
    ).toMatchObject({ tag: "久期", reason: "feedback" });
  });
});

describe("getAnalyticsV2Diagnosis", () => {
  it("keeps course/class scope in the query and counts completion by unique submitted assigned students", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "submitted",
              submittedAt: "2026-01-01T00:00:00Z",
            }),
            submission({
              id: "sub-2",
              studentId: "s2",
              status: "graded",
              score: 8,
              maxScore: 10,
              submittedAt: "2026-01-02T00:00:00Z",
            }),
          ],
        }),
      ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "s1", name: "S1", classId: "class-A" },
      { id: "s2", name: "S2", classId: "class-A" },
      { id: "s3", name: "S3", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      classId: "class-A",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(prisma.taskInstance.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          courseId: "course-1",
          classId: "class-A",
        }),
      }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "student", classId: { in: ["class-A"] } },
      }),
    );
    expect(result.kpis).toMatchObject({
      assignedStudents: 3,
      submittedStudents: 2,
      gradedStudents: 1,
      completionRate: 0.667,
      avgNormalizedScore: 80,
    });
  });

  it("uses groupIds as the assigned student union instead of the whole class", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          groupIds: ["group-1", "group-2"],
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 80,
              maxScore: 100,
              submittedAt: "2026-01-01T00:00:00Z",
            }),
            submission({
              id: "sub-2",
              studentId: "s3",
              status: "graded",
              score: 100,
              maxScore: 100,
              submittedAt: "2026-01-01T00:00:00Z",
            }),
          ],
        }),
      ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "s1", name: "S1", classId: "class-A" },
      { id: "s2", name: "S2", classId: "class-A" },
      { id: "s3", name: "S3", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([
      {
        id: "group-1",
        classId: "class-A",
        members: [
          { student: { id: "s1", name: "S1", classId: "class-A", role: "student" } },
          { student: { id: "s2", name: "S2", classId: "class-A", role: "student" } },
        ],
      },
      {
        id: "group-2",
        classId: "class-A",
        members: [
          { student: { id: "s2", name: "S2", classId: "class-A", role: "student" } },
        ],
      },
    ]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.kpis.assignedStudents).toBe(2);
    expect(result.kpis.submittedStudents).toBe(1);
    expect(result.kpis.completionRate).toBe(0.5);
    expect(result.kpis.avgNormalizedScore).toBe(80);
  });
});
