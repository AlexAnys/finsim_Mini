import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Fix 6 · AI 批改失败给学生看得见的提示
 *
 * 覆盖：
 * 1) gradeSubmission 失败时，对 sim / subjective 写入 evaluation.feedback（status="failed"）
 * 2) stripSubmissionForStudent 在 status="failed" 时保留 evaluation.feedback（其它字段仍剥离）
 */

// ---------- 共享 mock 状态（按调用顺序拉记录） ----------
const updateSubmissionGradeCalls: Array<{
  submissionId: string;
  data: Record<string, unknown>;
}> = [];
const logAuditCalls: Array<{ action: string; metadata?: Record<string, unknown> }> = [];

vi.mock("@/lib/services/submission.service", async () => {
  // 真实导入 stripSubmissionForStudent / deriveAnalysisStatus（这两个是纯函数，要原版来跑测试），
  // 但把 updateSubmissionGrade mock 掉以避免触达 prisma。
  const actual = await vi.importActual<typeof import("@/lib/services/submission.service")>(
    "@/lib/services/submission.service",
  );
  return {
    ...actual,
    updateSubmissionGrade: vi.fn(async (id: string, data: Record<string, unknown>) => {
      updateSubmissionGradeCalls.push({ submissionId: id, data });
      return { id };
    }),
  };
});

vi.mock("@/lib/services/audit.service", () => ({
  logAudit: vi.fn(async (entry: { action: string; metadata?: Record<string, unknown> }) => {
    logAuditCalls.push(entry);
  }),
}));

vi.mock("@/lib/services/ai.service", () => ({
  evaluateSimulation: vi.fn(),
  aiGenerateJSON: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    submission: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import * as aiService from "@/lib/services/ai.service";
import { gradeSubmission } from "@/lib/services/grading.service";
import { stripSubmissionForStudent } from "@/lib/services/submission.service";

beforeEach(() => {
  vi.clearAllMocks();
  updateSubmissionGradeCalls.length = 0;
  logAuditCalls.length = 0;
});

describe("Fix 6 · grading.service writes user-visible failure feedback", () => {
  it("simulation: AI 返回非法 JSON → status=failed + evaluation.feedback 中文兜底", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sub-sim-1",
      studentId: "stu-1",
      taskType: "simulation",
      taskId: "task-1",
      taskInstanceId: "ti-1",
      submittedAt: new Date("2026-04-01T10:00:00Z"),
      simulationSubmission: {
        transcript: [{ role: "student", text: "hi" }],
        assets: null,
      },
      task: {
        taskName: "测试模拟",
        requirements: "",
        simulationConfig: {
          scenario: "投资顾问",
          evaluatorPersona: "",
          strictnessLevel: "MODERATE",
        },
        scoringCriteria: [
          { id: "c1", name: "维度1", maxPoints: 10, description: "" },
          { id: "c2", name: "维度2", maxPoints: 10, description: "" },
        ],
      },
      taskInstance: { id: "ti-1", releaseMode: "manual", autoReleaseAt: null, dueAt: null, createdBy: "tea-1" },
    });

    // 模拟 JSON parse 类失败：抛带 "Unexpected token" 的 Error
    (aiService.evaluateSimulation as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Unexpected token } in JSON at position 42"),
    );

    await expect(gradeSubmission("sub-sim-1")).rejects.toThrow();

    // 第一次写 status=grading；之后写 status=failed + evaluation.feedback
    const failedCall = updateSubmissionGradeCalls.find(
      (c) => (c.data as { status?: string }).status === "failed",
    );
    expect(failedCall).toBeDefined();
    const evalData = (failedCall!.data as { evaluation?: { feedback?: string } }).evaluation;
    expect(evalData?.feedback).toContain("AI 批改暂未完成");
    expect(evalData?.feedback).toContain("模型输出格式异常");

    // audit log 写了 failed
    expect(logAuditCalls.some((l) => l.action === "submission.grade.failed")).toBe(true);
  });

  it("subjective: AI 返回非法 JSON → status=failed + evaluation.feedback 中文兜底", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sub-subj-1",
      studentId: "stu-1",
      taskType: "subjective",
      taskId: "task-2",
      taskInstanceId: "ti-2",
      submittedAt: new Date("2026-04-02T10:00:00Z"),
      subjectiveSubmission: {
        textAnswer: "这是答题内容，长度足够触发 AI 批改。",
        extractedText: "",
      },
      task: {
        taskName: "测试主观",
        requirements: "",
        subjectiveConfig: {
          prompt: "请论述",
          evaluatorPersona: "",
          strictnessLevel: "MODERATE",
          referenceAnswer: "",
        },
        scoringCriteria: [
          { id: "c1", name: "维度1", maxPoints: 10, description: "" },
        ],
      },
      taskInstance: { id: "ti-2", releaseMode: "manual", autoReleaseAt: null, dueAt: null, createdBy: "tea-1" },
    });

    // subjective 走 aiGenerateJSON — schema 失败抛 ZodError-shape
    const zErr = new Error("schema validation failed");
    zErr.name = "ZodError";
    (aiService.aiGenerateJSON as ReturnType<typeof vi.fn>).mockRejectedValue(zErr);

    await expect(gradeSubmission("sub-subj-1")).rejects.toThrow();

    const failedCall = updateSubmissionGradeCalls.find(
      (c) => (c.data as { status?: string }).status === "failed",
    );
    expect(failedCall).toBeDefined();
    const evalData = (failedCall!.data as { evaluation?: { feedback?: string } }).evaluation;
    expect(evalData?.feedback).toContain("AI 批改暂未完成");
  });

  it("simulation: 非 JSON 类错误（如 network）→ 通用中文兜底文案（不带『格式异常』）", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sub-sim-2",
      studentId: "stu-1",
      taskType: "simulation",
      taskId: "task-3",
      taskInstanceId: null,
      submittedAt: new Date("2026-04-03T10:00:00Z"),
      simulationSubmission: { transcript: [], assets: null },
      task: {
        taskName: "x",
        requirements: "",
        simulationConfig: { scenario: "", evaluatorPersona: "", strictnessLevel: "MODERATE" },
        scoringCriteria: [{ id: "c1", name: "维度1", maxPoints: 10, description: "" }],
      },
      taskInstance: null,
    });
    (aiService.evaluateSimulation as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("ECONNRESET"),
    );

    await expect(gradeSubmission("sub-sim-2")).rejects.toThrow();

    const failedCall = updateSubmissionGradeCalls.find(
      (c) => (c.data as { status?: string }).status === "failed",
    );
    expect(failedCall).toBeDefined();
    const evalData = (failedCall!.data as { evaluation?: { feedback?: string } }).evaluation;
    expect(evalData?.feedback).toContain("AI 批改暂未完成");
    expect(evalData?.feedback).not.toContain("格式异常");
  });

  it("quiz: 外层失败时不覆盖 quiz 简答的 per-question fallback（写 evaluation 跳过）", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sub-quiz-1",
      studentId: "stu-1",
      taskType: "quiz",
      taskId: "task-4",
      taskInstanceId: null,
      submittedAt: new Date("2026-04-04T10:00:00Z"),
      quizSubmission: { answers: [] },
      task: {
        quizConfig: {},
        scoringCriteria: [],
        quizQuestions: [],
      },
      taskInstance: null,
    });

    // quiz 路径里 extractQuizConceptTags 是 try/catch 不外抛；这里强制制造一个外层抛错：mock prisma.submission.findUnique 让 simulation/quiz 路径找不到（其实不到那一步），用更直接的方式：直接 throw inside grade flow。
    // 简单地：让 quizSubmission 空数组 + questions 空 → 不抛 — 改 strategy：mock updateSubmissionGrade 第一次（status=grading）成功，第二次（status=graded）抛错。
    const calls: number[] = [];
    const mod = await import("@/lib/services/submission.service");
    (mod.updateSubmissionGrade as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: string, data: Record<string, unknown>) => {
        calls.push(calls.length);
        updateSubmissionGradeCalls.push({ submissionId: id, data });
        // 第二次（status=graded）失败 → 触发 outer catch
        if ((data as { status?: string }).status === "graded") {
          throw new Error("DB_WRITE_FAILED");
        }
        return { id };
      },
    );

    await expect(gradeSubmission("sub-quiz-1")).rejects.toThrow();

    // 找 outer-catch 写的那次（status=failed 但 evaluation 应缺省）
    const failedCalls = updateSubmissionGradeCalls.filter(
      (c) => (c.data as { status?: string }).status === "failed",
    );
    // quiz 走 writeGradingFailureFeedback 但函数体 early return（taskType !== sim/subjective），
    // 因此 status=failed 的 updateSubmissionGrade 不应被调用（quiz 自身已写 evaluation 或 grading.service 不再写）
    expect(failedCalls.length).toBe(0);
  });
});

describe("Fix 6 · stripSubmissionForStudent preserves feedback when status='failed'", () => {
  it("simulation: status=failed → evaluation 保留 feedback 字段，其它剥离", () => {
    const sub = {
      id: "sub-1",
      status: "failed",
      releasedAt: null,
      score: 0,
      maxScore: 20,
      studentId: "stu-1",
      simulationSubmission: {
        id: "ss-1",
        transcript: [{ role: "student", text: "hi" }],
        evaluation: {
          totalScore: 0,
          maxScore: 20,
          feedback: "AI 批改暂未完成，请联系老师手动批改。",
          rubricBreakdown: [{ criterionId: "c1", score: 0, maxScore: 10, comment: "批改失败" }],
        },
        conceptTags: ["不应被泄露"],
      },
    };
    const out = stripSubmissionForStudent(sub as unknown as Record<string, unknown>);
    expect(out.score).toBeNull();
    expect(out.maxScore).toBeNull();
    expect(out.analysisStatus).toBe("pending");
    const ss = out.simulationSubmission as Record<string, unknown>;
    expect(ss.evaluation).toEqual({
      feedback: "AI 批改暂未完成，请联系老师手动批改。",
    });
    expect(ss.conceptTags).toEqual([]);
    expect(ss.transcript).toEqual([{ role: "student", text: "hi" }]);
  });

  it("subjective: status=failed + 无 feedback → evaluation 为 null（兜底前端 hard-coded 文案）", () => {
    const sub = {
      id: "sub-2",
      status: "failed",
      releasedAt: null,
      subjectiveSubmission: {
        id: "subs-1",
        textAnswer: "答题",
        evaluation: { totalScore: 0 }, // 无 feedback
        conceptTags: [],
      },
    };
    const out = stripSubmissionForStudent(sub as unknown as Record<string, unknown>);
    const ss = out.subjectiveSubmission as Record<string, unknown>;
    expect(ss.evaluation).toBeNull();
  });

  it("status=graded 时不受 Fix 6 改动影响（仍剥离 evaluation 为 null）", () => {
    const sub = {
      id: "sub-3",
      status: "graded",
      releasedAt: null,
      score: 85,
      maxScore: 100,
      simulationSubmission: {
        evaluation: { totalScore: 85, feedback: "good" },
        conceptTags: ["CAPM"],
      },
    };
    const out = stripSubmissionForStudent(sub as unknown as Record<string, unknown>);
    const ss = out.simulationSubmission as Record<string, unknown>;
    expect(ss.evaluation).toBeNull();
    expect(out.analysisStatus).toBe("analyzed_unreleased");
  });

  it("status=submitted 时不受 Fix 6 改动影响", () => {
    const sub = {
      id: "sub-4",
      status: "submitted",
      releasedAt: null,
      simulationSubmission: {
        evaluation: null,
        conceptTags: [],
      },
    };
    const out = stripSubmissionForStudent(sub as unknown as Record<string, unknown>);
    const ss = out.simulationSubmission as Record<string, unknown>;
    expect(ss.evaluation).toBeNull();
    expect(out.analysisStatus).toBe("pending");
  });
});

describe("Fix 6 r2 · joinSubmissions picks evaluation from nested submission tables", () => {
  // QA r1 FAIL 修复：lib/utils/grades-transforms.ts 之前读 s.evaluation（Submission 顶层），
  // 但 Submission schema 没有 evaluation 字段（仅 simulationSubmission/quizSubmission/subjectiveSubmission 上有）。
  // 这导致 EvaluationPanel 永远走 hard-coded fallback，看不到差异化的 FAILED_FEEDBACK_JSON。
  it("simulation: row.evaluation 来自 simulationSubmission.evaluation（含 JSON-shape 失败的 feedback）", async () => {
    const { joinSubmissions } = await import("@/lib/utils/grades-transforms");
    const rows = joinSubmissions(
      [
        {
          id: "sub-1",
          taskId: "t-1",
          taskInstanceId: "ti-1",
          taskType: "simulation",
          status: "failed",
          score: null,
          maxScore: null,
          simulationSubmission: {
            evaluation: {
              feedback: "AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。",
            },
          },
          submittedAt: "2026-05-13T10:00:00Z",
          gradedAt: null,
        },
      ],
      [],
    );
    expect(rows[0].evaluation).toEqual({
      feedback: "AI 批改暂未完成（模型输出格式异常），请联系老师手动批改。",
    });
  });

  it("subjective: row.evaluation 来自 subjectiveSubmission.evaluation（通用失败的 feedback）", async () => {
    const { joinSubmissions } = await import("@/lib/utils/grades-transforms");
    const rows = joinSubmissions(
      [
        {
          id: "sub-2",
          taskId: "t-2",
          taskInstanceId: "ti-2",
          taskType: "subjective",
          status: "failed",
          score: null,
          maxScore: null,
          subjectiveSubmission: {
            evaluation: { feedback: "AI 批改暂未完成，请联系老师手动批改。" },
          },
          submittedAt: "2026-05-13T10:00:00Z",
          gradedAt: null,
        },
      ],
      [],
    );
    expect(rows[0].evaluation).toEqual({
      feedback: "AI 批改暂未完成，请联系老师手动批改。",
    });
  });

  it("quiz: row.evaluation 来自 quizSubmission.evaluation", async () => {
    const { joinSubmissions } = await import("@/lib/utils/grades-transforms");
    const rows = joinSubmissions(
      [
        {
          id: "sub-3",
          taskId: "t-3",
          taskInstanceId: "ti-3",
          taskType: "quiz",
          status: "graded",
          score: 80,
          maxScore: 100,
          quizSubmission: {
            evaluation: { feedback: "完成", quizBreakdown: [] },
          },
          submittedAt: "2026-05-13T10:00:00Z",
          gradedAt: "2026-05-13T10:05:00Z",
        },
      ],
      [],
    );
    expect(rows[0].evaluation).toEqual({ feedback: "完成", quizBreakdown: [] });
  });

  it("向后兼容：旧 mock 测试传顶层 evaluation 时仍能落到 row.evaluation（fallback）", async () => {
    const { joinSubmissions } = await import("@/lib/utils/grades-transforms");
    const rows = joinSubmissions(
      [
        {
          id: "sub-4",
          taskId: "t-4",
          taskInstanceId: "ti-4",
          taskType: "simulation",
          status: "graded",
          score: 90,
          maxScore: 100,
          // 旧测试 fixture：顶层 evaluation（未嵌套）— 仅兼容已有 pr-stu-1-grades.test.ts
          evaluation: { feedback: "legacy" },
          submittedAt: "2026-05-13T10:00:00Z",
          gradedAt: "2026-05-13T10:05:00Z",
        },
      ],
      [],
    );
    expect(rows[0].evaluation).toEqual({ feedback: "legacy" });
  });

  it("所有源都缺：evaluation = null", async () => {
    const { joinSubmissions } = await import("@/lib/utils/grades-transforms");
    const rows = joinSubmissions(
      [
        {
          id: "sub-5",
          taskId: "t-5",
          taskInstanceId: "ti-5",
          taskType: "simulation",
          status: "submitted",
          score: null,
          maxScore: null,
          submittedAt: "2026-05-13T10:00:00Z",
          gradedAt: null,
        },
      ],
      [],
    );
    expect(rows[0].evaluation).toBeNull();
  });
});
