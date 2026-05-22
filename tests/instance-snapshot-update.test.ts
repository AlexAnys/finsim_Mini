import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  updateTaskInstanceSnapshotSchema,
  updateInstanceSnapshotSimulationSchema,
  updateInstanceSnapshotQuizSchema,
  updateInstanceSnapshotSubjectiveSchema,
} from "@/lib/validators/task.schema";

/**
 * Unit A1 r1a · 教师编辑 instance.taskSnapshot
 * - Zod schema 三态 discriminated union 校验
 * - service / route 源结构 grep（守不变字段 + auth + count graded）
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Unit A1 r1a · Zod schema discriminated union", () => {
  it("simulation taskType 合法 patch（仅 simulationConfig 部分字段）", () => {
    const r = updateTaskInstanceSnapshotSchema.safeParse({
      taskType: "simulation",
      simulationConfig: {
        scenario: "新场景描述",
        openingLine: "你好，我们开始吧",
      },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.taskType).toBe("simulation");
  });

  it("simulation 允许 scoringCriteria + allocationSections 全量替换", () => {
    const r = updateTaskInstanceSnapshotSchema.safeParse({
      taskType: "simulation",
      scoringCriteria: [
        { name: "标准 1", maxPoints: 40, order: 0 },
        { name: "标准 2", maxPoints: 60, order: 1 },
      ],
      allocationSections: [
        {
          label: "投资组合",
          order: 0,
          items: [{ label: "现金", order: 0 }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("quiz taskType + quizConfig + quizQuestions 合法", () => {
    const r = updateTaskInstanceSnapshotSchema.safeParse({
      taskType: "quiz",
      quizConfig: { mode: "fixed", timeLimitMinutes: 30 },
      quizQuestions: [
        {
          type: "single_choice",
          prompt: "1+1=?",
          options: [
            { id: "a", text: "2" },
            { id: "b", text: "3" },
          ],
          correctOptionIds: ["a"],
          points: 1,
          order: 0,
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("subjective taskType + subjectiveConfig 合法（partial）", () => {
    const r = updateTaskInstanceSnapshotSchema.safeParse({
      taskType: "subjective",
      subjectiveConfig: {
        prompt: "请分析本案例的财务风险",
        strictnessLevel: "STRICT",
      },
    });
    expect(r.success).toBe(true);
  });

  it("非法 taskType 被拒", () => {
    const r = updateTaskInstanceSnapshotSchema.safeParse({
      taskType: "unknown",
      simulationConfig: { scenario: "x", openingLine: "y" },
    });
    expect(r.success).toBe(false);
  });

  it("simulation patch 含 quiz 专属字段被忽略（discriminated union 严格性）", () => {
    const r = updateInstanceSnapshotSimulationSchema.safeParse({
      taskType: "simulation",
      quizConfig: { mode: "fixed" },
    });
    // simulation schema 不含 quizConfig 字段 → strict 模式下应通过（不报错但忽略多余键）
    // discriminatedUnion 默认非 strict，多余字段 silently 接受
    expect(r.success).toBe(true);
  });

  it("scoringCriteria 数组里的 maxPoints 必须 >= 1", () => {
    const r = updateInstanceSnapshotQuizSchema.safeParse({
      taskType: "quiz",
      scoringCriteria: [{ name: "x", maxPoints: 0, order: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it("subjectiveConfig.prompt 空字符串被拒（继承自 subjectiveConfigSchema.prompt.min(1)）", () => {
    // 注意：partial() 让所有字段 optional，但若提供 prompt 仍校验 min(1)
    const r = updateInstanceSnapshotSubjectiveSchema.safeParse({
      taskType: "subjective",
      subjectiveConfig: { prompt: "" },
    });
    expect(r.success).toBe(false);
  });
});

describe("Unit A1 r1a · service 源结构", () => {
  it("updateTaskInstanceSnapshot 存在并 export", () => {
    const src = readFile("lib/services/task-instance.service.ts");
    expect(src).toContain("export async function updateTaskInstanceSnapshot");
  });

  it("service 守 task.id / taskType / taskName 不变（强制保留 currentSnapshot 值）", () => {
    const src = readFile("lib/services/task-instance.service.ts");
    expect(src).toContain("currentSnapshot.id !== undefined");
    expect(src).toContain("mergedSnapshot.id = currentSnapshot.id");
    expect(src).toContain("currentSnapshot.taskType !== undefined");
    expect(src).toContain("mergedSnapshot.taskType = currentSnapshot.taskType");
    expect(src).toContain("currentSnapshot.taskName !== undefined");
    expect(src).toContain("mergedSnapshot.taskName = currentSnapshot.taskName");
  });

  it("service 校验 patch.taskType === existing.taskType 否则抛 TASK_TYPE_MISMATCH", () => {
    const src = readFile("lib/services/task-instance.service.ts");
    expect(src).toMatch(/existing\.taskType !== patch\.taskType/);
    expect(src).toContain('throw new Error("TASK_TYPE_MISMATCH")');
  });

  it("service auth 检查走 isAuthorizedForInstance + 不匹配抛 FORBIDDEN", () => {
    const src = readFile("lib/services/task-instance.service.ts");
    expect(src).toMatch(/isAuthorizedForInstance\(existing, createdBy, userRole\)/);
    expect(src).toMatch(/throw new Error\("FORBIDDEN"\)/);
  });

  it("service deep-merge simulation/quiz/subjective 三态分支", () => {
    const src = readFile("lib/services/task-instance.service.ts");
    expect(src).toMatch(/patch\.taskType === "simulation"/);
    expect(src).toMatch(/patch\.taskType === "quiz"/);
    expect(src).toMatch(/patch\.taskType === "subjective"/);
    // 每个分支都用 ...currentX 合并旧字段
    expect(src).toMatch(/\.\.\.currentSim/);
    expect(src).toMatch(/\.\.\.currentQuiz/);
    expect(src).toMatch(/\.\.\.currentSub/);
  });

  it("service 返回 { instance, gradedCount } 且 gradedCount 来自 submission count where status='graded'", () => {
    const src = readFile("lib/services/task-instance.service.ts");
    expect(src).toMatch(/return \{ instance: updated, gradedCount \}/);
    expect(src).toMatch(/prisma\.submission\.count/);
    expect(src).toMatch(/status:\s*"graded"/);
  });
});

describe("Unit A1 r1a · route handler", () => {
  it("snapshot route 存在 + PATCH method + requireRole teacher/admin", () => {
    const src = readFile("app/api/lms/task-instances/[id]/snapshot/route.ts");
    expect(src).toContain("export async function PATCH");
    expect(src).toMatch(/requireRole\(\["teacher", "admin"\]\)/);
    expect(src).toContain("updateTaskInstanceSnapshotSchema");
    expect(src).toContain("updateTaskInstanceSnapshot");
  });

  it("route 使用 safeParse + validationError + handleServiceError", () => {
    const src = readFile("app/api/lms/task-instances/[id]/snapshot/route.ts");
    expect(src).toContain("safeParse");
    expect(src).toContain("validationError");
    expect(src).toContain("handleServiceError");
  });
});

describe("Unit A1 r1a · api-utils 错误映射", () => {
  it("TASK_TYPE_MISMATCH 映射到 400 中文消息", () => {
    const src = readFile("lib/api-utils.ts");
    expect(src).toMatch(/case "TASK_TYPE_MISMATCH":/);
    expect(src).toContain("任务类型不匹配，无法修改");
  });
});
