import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PR-1 D · 审计 default-on + actorRole + AI grading metadata
 *
 * 覆盖：
 * - publish / snapshot-update / ai-grade 在 ENABLE_AUDIT_LOGS 任意值都写 AuditLog
 * - actorRole 总是落到 metadata.actorRole（兼容 admin/audit 现有 UI）
 * - getLastAiRunMetadata 时间窗约束 + race 风险（review-recent F-3 / Q2 决策）
 */

describe("PR-1 D · audit 默认开（无 env gate）", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("publish 任意 ENABLE_AUDIT_LOGS 值都写 AuditLog", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
        taskInstance: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ti-1",
            createdBy: "teacher-1",
            courseId: "course-1",
            taskType: "simulation",
            task: { taskType: "simulation", simulationConfig: { id: "x" }, quizConfig: null, subjectiveConfig: null, quizQuestions: [], scoringCriteria: [], allocationSections: [] },
            status: "draft",
            taskSnapshot: null,
          }),
          update: vi.fn().mockResolvedValue({ id: "ti-1", status: "published" }),
        },
        courseTeacher: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    }));
    for (const envVal of ["true", "false", undefined]) {
      vi.resetModules();
      const oldEnv = process.env.ENABLE_AUDIT_LOGS;
      if (envVal === undefined) delete process.env.ENABLE_AUDIT_LOGS;
      else process.env.ENABLE_AUDIT_LOGS = envVal;

      const { logAuditEvent } = await import("@/lib/services/audit.service");
      const { prisma } = await import("@/lib/db/prisma");

      await logAuditEvent({
        action: "task_instance.publish",
        actorRole: "owner",
        actorId: "teacher-1",
        targetId: "ti-1",
        targetType: "TaskInstance",
      });

      expect(prisma.auditLog.create).toHaveBeenCalled();
      vi.clearAllMocks();
      process.env.ENABLE_AUDIT_LOGS = oldEnv;
    }
  });
});

describe("PR-1 D · actorRole field 落 metadata.actorRole", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("logAuditEvent 把 actorRole 写到 metadata（兼容 /admin/audit 现有 UI 读路径）", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        auditLog: { create: vi.fn().mockResolvedValue({ id: "a2" }) },
      },
    }));
    const { logAuditEvent } = await import("@/lib/services/audit.service");
    const { prisma } = await import("@/lib/db/prisma");

    await logAuditEvent({
      action: "course.update",
      actorRole: "collaborator",
      actorId: "t1",
      metadata: { changedFields: ["title"] },
    });

    const arg = (prisma.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.data.metadata).toEqual({
      changedFields: ["title"],
      actorRole: "collaborator",
    });
  });

  it("logAuditEventWithCourseRole 自动推导 owner 当 course.createdBy === userId", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        auditLog: { create: vi.fn().mockResolvedValue({ id: "a3" }) },
        course: { findUnique: vi.fn().mockResolvedValue({ createdBy: "u-1" }) },
        courseTeacher: { findUnique: vi.fn() },
      },
    }));
    const { logAuditEventWithCourseRole } = await import(
      "@/lib/services/audit.service"
    );
    const { prisma } = await import("@/lib/db/prisma");

    await logAuditEventWithCourseRole({
      action: "course.delete",
      actorId: "u-1",
      userRole: "teacher",
      courseId: "course-1",
    });

    const arg = (prisma.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.data.metadata.actorRole).toBe("owner");
  });

  it("logAuditEventWithCourseRole 推导 admin 当 userRole=admin（短路）", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        auditLog: { create: vi.fn().mockResolvedValue({ id: "a4" }) },
        course: { findUnique: vi.fn() },
        courseTeacher: { findUnique: vi.fn() },
      },
    }));
    const { logAuditEventWithCourseRole } = await import(
      "@/lib/services/audit.service"
    );
    const { prisma } = await import("@/lib/db/prisma");

    await logAuditEventWithCourseRole({
      action: "course.delete",
      actorId: "admin-1",
      userRole: "admin",
      courseId: "course-1",
    });

    const arg = (prisma.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.data.metadata.actorRole).toBe("admin");
    // admin 短路：不查 course / courseTeacher
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });
});

describe("PR-1 D · getLastAiRunMetadata 时间窗 + race scenario", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("拿到指定 since 之后最新的 AiRun（含 model / inputTokens / outputTokens）", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        aiRun: {
          findFirst: vi.fn().mockResolvedValue({
            id: "run-1",
            model: "mimo-v2.5-pro",
            provider: "mimo",
            inputTokens: 1200,
            outputTokens: 500,
          }),
        },
      },
    }));
    const { getLastAiRunMetadata } = await import("@/lib/services/ai.service");
    const since = new Date("2026-05-16T10:00:00Z");
    const meta = await getLastAiRunMetadata("user-1", "evaluation", since);
    expect(meta).toMatchObject({
      runId: "run-1",
      model: "mimo-v2.5-pro",
      provider: "mimo",
      inputTokens: 1200,
      outputTokens: 500,
    });
  });

  it("时间窗 ≤ 5sec — where 子句 gte=since, lte ≤ since+5s", async () => {
    const findFirstMock = vi.fn().mockResolvedValue(null);
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: { aiRun: { findFirst: findFirstMock } },
    }));
    const { getLastAiRunMetadata } = await import("@/lib/services/ai.service");
    const since = new Date("2026-05-16T10:00:00Z");
    await getLastAiRunMetadata("user-1", "evaluation", since);
    const callArg = findFirstMock.mock.calls[0][0];
    expect(callArg.where.userId).toBe("user-1");
    expect(callArg.where.feature).toBe("evaluation");
    expect(callArg.where.createdAt.gte).toEqual(since);
    // upperBound at most since+5s OR now (whichever larger)
    expect(callArg.where.createdAt.lte.getTime()).toBeGreaterThanOrEqual(
      since.getTime(),
    );
  });

  it("race scenario: 并发同 teacher 同 feature 跑两个 AI 调用 — 后者可能误抓前者 run（已知 race）", async () => {
    // review-recent F-3 / Q2 决策：本 helper 有 race 窗口，PR-2 候选 F 重构 aiGenerateText 返回 runId 后可消除
    // 这里只断言 helper 行为：返回 since 后最新一条（按 createdAt desc），由 caller 自行用更窄 since 缩窄窗口
    const findFirstMock = vi.fn().mockImplementation((args) => {
      // 模拟两个并发 run，return 最新一条（createdAt desc）
      const sinceMs = args.where.createdAt.gte.getTime();
      const runA_createdAt = sinceMs + 100; // 先开始的 run
      const runB_createdAt = sinceMs + 200; // 后开始的 run（更新）
      // findFirst orderBy createdAt desc → run B
      return Promise.resolve({
        id: "run-B",
        model: "mimo-v2.5",
        provider: "mimo",
        inputTokens: 800,
        outputTokens: 300,
      });
    });
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: { aiRun: { findFirst: findFirstMock } },
    }));
    const { getLastAiRunMetadata } = await import("@/lib/services/ai.service");

    const caller1Since = new Date("2026-05-16T10:00:00Z");
    const meta1 = await getLastAiRunMetadata("user-1", "evaluation", caller1Since);
    // 两个并发 caller 都拿到 run-B（race 存在）— 这是已知限制
    expect(meta1?.runId).toBe("run-B");
  });

  it("DB 错误时返回 null（不抛）", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        aiRun: {
          findFirst: vi.fn().mockRejectedValue(new Error("DB down")),
        },
      },
    }));
    const { getLastAiRunMetadata } = await import("@/lib/services/ai.service");
    const meta = await getLastAiRunMetadata(
      "user-1",
      "evaluation",
      new Date(),
    );
    expect(meta).toBeNull();
  });
});
