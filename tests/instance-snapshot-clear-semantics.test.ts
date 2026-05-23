import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskInstance: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    submission: {
      count: vi.fn(),
    },
    courseTeacher: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db/prisma";
import { updateTaskInstanceSnapshot } from "@/lib/services/task-instance.service";
import {
  updateTaskInstanceSnapshotSchema,
  updateInstanceSnapshotQuizSchema,
  updateInstanceSnapshotSimulationSchema,
  updateInstanceSnapshotSubjectiveSchema,
} from "@/lib/validators/task.schema";

const mFind = () =>
  prisma.taskInstance.findUnique as unknown as ReturnType<typeof vi.fn>;
const mUpdate = () =>
  prisma.taskInstance.update as unknown as ReturnType<typeof vi.fn>;
const mTx = () => prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

describe("Slice 1 · null=clear schema", () => {
  it("quiz schema 接受 timeLimitMinutes:null", () => {
    const r = updateInstanceSnapshotQuizSchema.safeParse({
      taskType: "quiz",
      quizConfig: { mode: "fixed", timeLimitMinutes: null },
    });
    expect(r.success).toBe(true);
  });

  it("quiz schema 接受 maxQuestions/startDifficulty/difficultyStep null", () => {
    const r = updateInstanceSnapshotQuizSchema.safeParse({
      taskType: "quiz",
      quizConfig: {
        mode: "adaptive",
        maxQuestions: null,
        startDifficulty: null,
        difficultyStep: null,
      },
    });
    expect(r.success).toBe(true);
  });

  it("simulation schema 接受 dialogueRequirements:null", () => {
    const r = updateInstanceSnapshotSimulationSchema.safeParse({
      taskType: "simulation",
      simulationConfig: {
        scenario: "x",
        openingLine: "y",
        dialogueRequirements: null,
      },
    });
    expect(r.success).toBe(true);
  });

  it("subjective schema 接受 referenceAnswer:null", () => {
    const r = updateInstanceSnapshotSubjectiveSchema.safeParse({
      taskType: "subjective",
      subjectiveConfig: { prompt: "x", referenceAnswer: null },
    });
    expect(r.success).toBe(true);
  });

  it("discriminated union 路径也通", () => {
    const r = updateTaskInstanceSnapshotSchema.safeParse({
      taskType: "quiz",
      quizConfig: { mode: "fixed", timeLimitMinutes: null },
    });
    expect(r.success).toBe(true);
  });
});

describe("Slice 1 · service null=clear 语义", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("quiz timeLimitMinutes=null 从 merged snapshot 删除字段", async () => {
    mFind().mockResolvedValue({
      id: "i1",
      createdBy: "u1",
      courseId: "c1",
      taskType: "quiz",
      taskSnapshot: {
        id: "t1",
        taskType: "quiz",
        taskName: "测验",
        quizConfig: { mode: "fixed", timeLimitMinutes: 30, showCorrectAnswer: false },
      },
    });
    mTx().mockImplementation(async (ops: unknown[]) => {
      void ops;
      return [{ id: "i1" }, 0];
    });

    await updateTaskInstanceSnapshot("i1", "u1", {
      taskType: "quiz",
      quizConfig: { timeLimitMinutes: null },
    });

    expect(mUpdate()).toHaveBeenCalledTimes(1);
    const call = mUpdate().mock.calls[0][0];
    const merged = call.data.taskSnapshot as Record<string, unknown>;
    const quizConfig = merged.quizConfig as Record<string, unknown>;
    expect(quizConfig).not.toHaveProperty("timeLimitMinutes");
    // 同 patch 没 mention 的 showCorrectAnswer 还在
    expect(quizConfig.showCorrectAnswer).toBe(false);
    // mode 仍是旧值
    expect(quizConfig.mode).toBe("fixed");
  });

  it("simulation dialogueRequirements=null 从 merged snapshot 删除字段", async () => {
    mFind().mockResolvedValue({
      id: "i2",
      createdBy: "u1",
      courseId: "c1",
      taskType: "simulation",
      taskSnapshot: {
        id: "t2",
        taskType: "simulation",
        taskName: "模拟",
        simulationConfig: {
          scenario: "s",
          openingLine: "o",
          dialogueRequirements: "旧要求",
          strictnessLevel: "MODERATE",
        },
      },
    });
    mTx().mockImplementation(async () => [{ id: "i2" }, 0]);

    await updateTaskInstanceSnapshot("i2", "u1", {
      taskType: "simulation",
      simulationConfig: { dialogueRequirements: null },
    });

    const call = mUpdate().mock.calls[0][0];
    const merged = call.data.taskSnapshot as Record<string, unknown>;
    const sim = merged.simulationConfig as Record<string, unknown>;
    expect(sim).not.toHaveProperty("dialogueRequirements");
    expect(sim.scenario).toBe("s");
    expect(sim.strictnessLevel).toBe("MODERATE");
  });

  it("undefined 仍然是 keep（不删字段）", async () => {
    mFind().mockResolvedValue({
      id: "i3",
      createdBy: "u1",
      courseId: "c1",
      taskType: "quiz",
      taskSnapshot: {
        id: "t3",
        taskType: "quiz",
        taskName: "测验",
        quizConfig: { mode: "fixed", timeLimitMinutes: 30 },
      },
    });
    mTx().mockImplementation(async () => [{ id: "i3" }, 0]);

    await updateTaskInstanceSnapshot("i3", "u1", {
      taskType: "quiz",
      quizConfig: { mode: "fixed" },
    });

    const call = mUpdate().mock.calls[0][0];
    const merged = call.data.taskSnapshot as Record<string, unknown>;
    const quizConfig = merged.quizConfig as Record<string, unknown>;
    expect(quizConfig.timeLimitMinutes).toBe(30);
  });
});
