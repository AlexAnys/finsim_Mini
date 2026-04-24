import { describe, it, expect } from "vitest";
import {
  TASK_TYPE_META,
  WIZARD_STEPS,
  type TaskType,
} from "@/components/task-wizard/wizard-types";

describe("task-wizard WIZARD_STEPS", () => {
  it("defines exactly 4 steps in order", () => {
    expect(WIZARD_STEPS).toHaveLength(4);
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual([0, 1, 2, 3]);
    expect(WIZARD_STEPS.map((s) => s.label)).toEqual([
      "任务类型",
      "基本信息",
      "任务配置",
      "预览并创建",
    ]);
  });

  it("每个 step 都有非空 desc", () => {
    for (const s of WIZARD_STEPS) {
      expect(s.desc).toBeTruthy();
      expect(s.desc.length).toBeGreaterThan(0);
    }
  });
});

describe("task-wizard TASK_TYPE_META", () => {
  const types: TaskType[] = ["simulation", "quiz", "subjective"];

  it("三种任务类型全都有 meta 定义", () => {
    for (const t of types) {
      expect(TASK_TYPE_META[t]).toBeDefined();
    }
  });

  it("三种任务类型各自绑定不同 token 类（对齐 3 色系统）", () => {
    const textClasses = types.map((t) => TASK_TYPE_META[t].textClass);
    expect(new Set(textClasses).size).toBe(3);
    expect(textClasses).toEqual(["text-sim", "text-quiz", "text-subj"]);

    const softClasses = types.map((t) => TASK_TYPE_META[t].softClass);
    expect(new Set(softClasses).size).toBe(3);
    expect(softClasses).toEqual(["bg-sim-soft", "bg-quiz-soft", "bg-subj-soft"]);
  });

  it("中文 label 映射齐全", () => {
    expect(TASK_TYPE_META.simulation.label).toBe("模拟对话");
    expect(TASK_TYPE_META.quiz.label).toBe("测验");
    expect(TASK_TYPE_META.subjective.label).toBe("主观题");
  });

  it("每种类型都有 icon / stats / time / desc", () => {
    for (const t of types) {
      const meta = TASK_TYPE_META[t];
      expect(meta.icon).toBeDefined();
      expect(meta.stats).toBeInstanceOf(Array);
      expect(meta.stats.length).toBeGreaterThan(0);
      expect(meta.time).toBeTruthy();
      expect(meta.desc).toBeTruthy();
    }
  });
});
