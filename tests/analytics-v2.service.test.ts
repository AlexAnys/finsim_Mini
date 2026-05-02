import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    taskInstance: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    studentGroup: { findMany: vi.fn() },
    studyBuddyPost: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import {
  buildDataInsightFingerprint,
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
  quizEvaluation?: unknown;
  quizConceptTags?: string[];
  subjectiveEvaluation?: unknown;
  subjectiveConceptTags?: string[];
  taskType?: "quiz" | "simulation" | "subjective";
  releasedAt?: string | null;
}) {
  const taskType = overrides.taskType ?? "quiz";
  return {
    id: overrides.id,
    studentId: overrides.studentId,
    taskType,
    status: overrides.status,
    score: overrides.score ?? null,
    maxScore: overrides.maxScore ?? null,
    submittedAt: new Date(overrides.submittedAt),
    releasedAt: overrides.releasedAt === undefined ? new Date("2026-01-06T00:00:00Z") : overrides.releasedAt ? new Date(overrides.releasedAt) : null,
    student: { id: overrides.studentId, name: overrides.studentId.toUpperCase() },
    simulationSubmission: null,
    quizSubmission: {
      evaluation: overrides.quizEvaluation ?? null,
      conceptTags: overrides.quizConceptTags ?? [],
      durationSeconds: null,
    },
    subjectiveSubmission:
      taskType === "subjective"
        ? {
            evaluation: overrides.subjectiveEvaluation ?? null,
            conceptTags: overrides.subjectiveConceptTags ?? [],
          }
        : null,
  };
}

function instance(overrides: {
  id?: string;
  title?: string;
  classId?: string;
  groupIds?: string[];
  taskType?: "quiz" | "simulation" | "subjective";
  chapterId?: string | null;
  chapterTitle?: string | null;
  createdAt?: string;
  publishedAt?: string | null;
  dueAt?: string;
  submissions?: ReturnType<typeof submission>[];
}) {
  const classId = overrides.classId ?? "class-A";
  const taskType = overrides.taskType ?? "quiz";
  const chapterId = overrides.chapterId === undefined ? "chapter-1" : overrides.chapterId;
  return {
    id: overrides.id ?? "inst-1",
    title: overrides.title ?? "课后测验",
    taskId: "task-1",
    taskType,
    classId,
    groupIds: overrides.groupIds ?? [],
    chapterId,
    sectionId: chapterId ? "section-1" : null,
    createdAt: new Date(overrides.createdAt ?? "2026-01-01T00:00:00Z"),
    publishedAt: overrides.publishedAt === null ? null : new Date(overrides.publishedAt ?? "2026-01-01T00:00:00Z"),
    dueAt: new Date(overrides.dueAt ?? "2026-01-05T00:00:00Z"),
    class: { id: classId, name: classId === "class-A" ? "A 班" : "B 班" },
    chapter: chapterId ? { id: chapterId, title: overrides.chapterTitle ?? "资产配置", order: 1 } : null,
    section: chapterId ? { id: "section-1", title: "风险预算", chapterId, order: 1 } : null,
    task: {
      quizQuestions: [
        { id: "q1", prompt: "CAPM 中 beta 衡量什么？", points: 5, order: 1 },
        { id: "q2", prompt: "风险预算的作用是什么？", points: 5, order: 2 },
      ],
      scoringCriteria: [
        { id: "r1", name: "概念准确性", maxPoints: 5, order: 1 },
        { id: "r2", name: "推理完整性", maxPoints: 5, order: 2 },
      ],
    },
    submissions: overrides.submissions ?? [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mk(prisma.studyBuddyPost.findMany).mockResolvedValue([]);
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

describe("analytics-v2 advice fingerprint", () => {
  it("does not change when only generatedAt changes", () => {
    const baseDiagnosis = {
      scope: {
        courseId: "course-1",
        courseTitle: "金融模拟",
        chapterId: null,
        sectionId: null,
        classId: null,
        taskType: null,
        taskInstanceId: "inst-1",
        scorePolicy: "latest",
        range: "term",
        dateFrom: null,
        dateTo: null,
        scoreBins: "standard",
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
      kpis: { completionRate: 1, avgNormalizedScore: 80 },
      scoreDistribution: { bins: [{ id: "80-89", count: 1 }] },
      risks: { chapters: [], students: [], pendingReleases: [] },
      studyBuddySignals: { groups: [] },
      taskPerformance: { selectedInstanceId: "inst-1", highExamples: [], lowIssues: [] },
    };

    expect(buildDataInsightFingerprint(baseDiagnosis as never)).toBe(
      buildDataInsightFingerprint({
        ...baseDiagnosis,
        scope: { ...baseDiagnosis.scope, generatedAt: "2026-01-02T00:00:00.000Z" },
      } as never),
    );
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

  it("limits chapter diagnostics to the active chapter scope", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      ...course,
      chapters: [
        ...course.chapters,
        {
          id: "chapter-2",
          title: "保险规划",
          order: 2,
          sections: [],
        },
      ],
    });
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 80,
              maxScore: 100,
              submittedAt: "2026-01-01T00:00:00Z",
            }),
          ],
        }),
      ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "s1", name: "S1", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      chapterId: "chapter-1",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.chapterDiagnostics.map((chapter) => chapter.chapterId)).toEqual([
      "chapter-1",
    ]);
  });

  it("aggregates quiz question diagnostics from selected quiz breakdown rows", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 5,
              maxScore: 10,
              submittedAt: "2026-01-01T00:00:00Z",
              quizConceptTags: ["CAPM"],
              quizEvaluation: {
                quizBreakdown: [
                  { questionId: "q1", score: 5, maxScore: 5, correct: true, comment: "回答正确" },
                  { questionId: "q2", score: 0, maxScore: 5, correct: false, comment: "未作答" },
                ],
              },
            }),
            submission({
              id: "sub-2",
              studentId: "s2",
              status: "graded",
              score: 2,
              maxScore: 10,
              submittedAt: "2026-01-02T00:00:00Z",
              quizConceptTags: ["风险预算"],
              quizEvaluation: {
                quizBreakdown: [
                  { questionId: "q1", score: 0, maxScore: 5, correct: false, comment: "正确答案: beta" },
                  { questionId: "q2", score: 2, maxScore: 5, correct: false, comment: "部分正确" },
                ],
              },
            }),
          ],
        }),
      ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "s1", name: "S1", classId: "class-A" },
      { id: "s2", name: "S2", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.quizDiagnostics).toEqual([
      expect.objectContaining({
        questionId: "q1",
        order: 1,
        prompt: "CAPM 中 beta 衡量什么？",
        correctRate: 0.5,
        unansweredRate: 0,
        avgScoreRate: 50,
        weakTags: ["风险预算"],
      }),
      expect.objectContaining({
        questionId: "q2",
        correctRate: 0,
        unansweredRate: 0.5,
        avgScoreRate: 20,
        weakTags: ["风险预算", "CAPM"],
      }),
    ]);
  });

  it("aggregates rubric diagnostics from subjective rubric breakdown rows", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([{ ...optionInstance, taskType: "subjective" }])
      .mockResolvedValueOnce([
        instance({
          taskType: "subjective",
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 6,
              maxScore: 10,
              taskType: "subjective",
              submittedAt: "2026-01-01T00:00:00Z",
              subjectiveEvaluation: {
                rubricBreakdown: [
                  { criterionId: "r1", score: 2, maxScore: 5, comment: "概念混淆" },
                  { criterionId: "r2", score: 4, maxScore: 5, comment: "推理尚可" },
                ],
              },
            }),
            submission({
              id: "sub-2",
              studentId: "s2",
              status: "graded",
              score: 9,
              maxScore: 10,
              taskType: "subjective",
              submittedAt: "2026-01-02T00:00:00Z",
              subjectiveEvaluation: {
                rubricBreakdown: [
                  { criterionId: "r1", score: 5, maxScore: 5, comment: "准确" },
                  { criterionId: "r2", score: 4, maxScore: 5, comment: "完整" },
                ],
              },
            }),
          ],
        }),
      ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "s1", name: "S1", classId: "class-A" },
      { id: "s2", name: "S2", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.simulationDiagnostics).toEqual([
      expect.objectContaining({
        criterionId: "r1",
        criterionName: "概念准确性",
        avgScoreRate: 70,
        lowScoreCount: 1,
        weakStudents: [{ studentId: "s1", studentName: "S1" }],
        sampleComments: ["概念混淆"],
      }),
      expect.objectContaining({
        criterionId: "r2",
        criterionName: "推理完整性",
        avgScoreRate: 80,
        lowScoreCount: 0,
        weakStudents: [],
      }),
    ]);
  });

  it("builds deterministic local weekly insight from diagnosis signals", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          title: "单元测验",
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 4,
              maxScore: 10,
              submittedAt: "2026-01-02T00:00:00Z",
              quizConceptTags: ["课堂概念"],
              quizEvaluation: {
                quizBreakdown: [
                  { questionId: "q1", score: 0, maxScore: 5, correct: false, comment: "概念混淆" },
                ],
              },
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
      now: new Date("2026-01-10T08:00:00Z"),
    });

    expect(result.weeklyInsight).toMatchObject({
      generatedAt: "2026-01-10T08:00:00.000Z",
      mode: "local_fallback",
      label: "本地生成/待 AI 增强",
    });
    expect(result.weeklyInsight.highlights[0]?.detail).toContain("当前范围覆盖 1 个实例");
    expect(result.weeklyInsight.risks.map((item) => item.title)).toEqual(
      expect.arrayContaining(["存在未完成风险", "存在低掌握风险"]),
    );
    expect(result.weeklyInsight.recommendations.map((item) => item.title)).toEqual(
      expect.arrayContaining(["先补齐未完成学生", "安排短讲评和再练习"]),
    );
  });

  it("returns chapter, class, and student growth trends for the active range", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          title: "成长测验",
          publishedAt: "2026-01-03T00:00:00Z",
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 5,
              maxScore: 10,
              submittedAt: "2026-01-03T00:00:00Z",
            }),
            submission({
              id: "sub-2",
              studentId: "s1",
              status: "graded",
              score: 8,
              maxScore: 10,
              submittedAt: "2026-01-04T00:00:00Z",
            }),
          ],
        }),
      ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "s1", name: "S1", classId: "class-A" },
      { id: "s2", name: "S2", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      range: "30d",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.trends.range).toBe("30d");
    expect(result.trends.chapterTrend).toEqual([
      expect.objectContaining({
        chapterId: "chapter-1",
        title: "资产配置",
        instanceCount: 1,
        completionRate: 0.5,
        avgNormalizedScore: 80,
        latestActivityAt: "2026-01-04T00:00:00.000Z",
      }),
    ]);
    expect(result.trends.classTrend).toEqual([
      expect.objectContaining({
        classId: "class-A",
        className: "A 班",
        assignedStudents: 2,
        submittedStudents: 1,
        completionRate: 0.5,
        avgNormalizedScore: 80,
      }),
    ]);
    expect(result.trends.studentGrowth).toEqual([
      expect.objectContaining({
        studentId: "s1",
        studentName: "S1",
        selectedScore: 80,
        bestScore: 80,
        improvement: 30,
        attemptCount: 2,
        completedInstances: 1,
        firstSubmittedAt: "2026-01-03T00:00:00.000Z",
        latestSubmittedAt: "2026-01-04T00:00:00.000Z",
      }),
    ]);
  });

  it("builds dashboard distribution, risks, pending releases, and Study Buddy signals", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 95,
              maxScore: 100,
              submittedAt: "2026-01-02T00:00:00Z",
            }),
            submission({
              id: "sub-2",
              studentId: "s2",
              status: "graded",
              score: 20,
              maxScore: 100,
              submittedAt: "2026-01-02T00:00:00Z",
              releasedAt: null,
              quizEvaluation: {
                quizBreakdown: [
                  { questionId: "q1", score: 0, maxScore: 5, correct: false, comment: "CAPM 概念错误" },
                ],
              },
              quizConceptTags: ["CAPM"],
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
    mk(prisma.studyBuddyPost.findMany).mockResolvedValue([
      {
        id: "post-1",
        taskId: "task-1",
        taskInstanceId: "inst-1",
        studentId: "s2",
        question: "CAPM 的 beta 怎么理解？",
        status: "pending",
        anonymous: true,
        task: { id: "task-1", taskName: "课后测验", taskType: "quiz" },
        student: { id: "s2", name: "S2", email: "s2@example.com" },
        taskInstance: {
          id: "inst-1",
          title: "课后测验",
          chapterId: "chapter-1",
          sectionId: "section-1",
          chapter: { id: "chapter-1", title: "资产配置", order: 1 },
          section: { id: "section-1", title: "风险预算", order: 1 },
        },
      },
      {
        id: "post-2",
        taskId: "task-1",
        taskInstanceId: "inst-1",
        studentId: "s1",
        question: "CAPM 的 beta 怎么理解？",
        status: "answered",
        anonymous: false,
        task: { id: "task-1", taskName: "课后测验", taskType: "quiz" },
        student: { id: "s1", name: "S1", email: "s1@example.com" },
        taskInstance: {
          id: "inst-1",
          title: "课后测验",
          chapterId: "chapter-1",
          sectionId: "section-1",
          chapter: { id: "chapter-1", title: "资产配置", order: 1 },
          section: { id: "section-1", title: "风险预算", order: 1 },
        },
      },
    ]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      taskInstanceId: "inst-1",
      scoreBins: "standard",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.generatedAt).toBe("2026-01-10T00:00:00.000Z");
    expect(result.kpis.pendingReleaseCount).toBe(1);
    expect(result.kpis.riskChapterCount).toBe(1);
    expect(result.kpis.riskStudentCount).toBe(2);
    expect(result.scoreDistribution.bins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "0-59", count: 1 }),
        expect.objectContaining({ id: "90-100", count: 1 }),
      ]),
    );
    expect(result.risks.pendingReleases[0]).toMatchObject({
      submissionId: "sub-2",
      studentName: "S2",
      instanceTitle: "课后测验",
    });
    expect(result.taskPerformance.highExamples[0]).toMatchObject({
      submissionId: "sub-1",
      evidenceKind: "quiz",
      normalizedScore: 95,
    });
    expect(result.taskPerformance.lowIssues[0]).toMatchObject({
      title: expect.stringContaining("CAPM 中 beta"),
    });
    expect(result.studyBuddySignals).toMatchObject({
      totalQuestions: 2,
      pendingQuestions: 1,
      activeStudents: 2,
      groups: [
        expect.objectContaining({
          chapterTitle: "资产配置",
          questionCount: 2,
          studentCount: 2,
          topQuestions: [
            expect.objectContaining({ question: "CAPM 的 beta 怎么理解？", count: 2 }),
          ],
          students: expect.arrayContaining([
            expect.objectContaining({ id: "s2", name: "匿名学生" }),
          ]),
        }),
      ],
    });
  });

  it("reports data quality flags without hiding raw abnormal metrics", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(course);
    mk(prisma.taskInstance.findMany)
      .mockResolvedValueOnce([optionInstance])
      .mockResolvedValueOnce([
        instance({
          submissions: [
            submission({
              id: "sub-1",
              studentId: "s1",
              status: "graded",
              score: 12,
              maxScore: 10,
              submittedAt: "2026-01-01T00:00:00Z",
            }),
            submission({
              id: "sub-2",
              studentId: "s1",
              status: "graded",
              score: 8,
              maxScore: 10,
              submittedAt: "2026-01-02T00:00:00Z",
            }),
          ],
        }),
        instance({
          id: "inst-2",
          title: "未绑定章节任务",
          classId: "class-B",
          chapterId: null,
          submissions: [
            submission({
              id: "sub-3",
              studentId: "s9",
              status: "submitted",
              submittedAt: "2026-01-02T00:00:00Z",
            }),
          ],
        }),
      ]);
    mk(prisma.user.findMany).mockResolvedValue([
      { id: "s1", name: "S1", classId: "class-A" },
    ]);
    mk(prisma.studentGroup.findMany).mockResolvedValue([]);

    const result = await getAnalyticsV2Diagnosis({
      courseId: "course-1",
      scorePolicy: "best",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.kpis.avgNormalizedScore).toBe(120);
    expect(result.dataQualityFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "aggregate:avg-score-over-100", category: "score" }),
        expect.objectContaining({ id: "inst-1:score-abnormal", category: "score" }),
        expect.objectContaining({ id: "inst-1:normalized-score-over-100", category: "score" }),
        expect.objectContaining({ id: "inst-1:multiple-attempts", category: "attempt" }),
        expect.objectContaining({ id: "inst-2:unbound-chapter", category: "scope" }),
        expect.objectContaining({ id: "inst-2:assignment-missing-with-submissions", category: "assignment" }),
      ]),
    );
  });
});
