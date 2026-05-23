import { describe, it, expect } from "vitest";
import { buildPatchBody } from "@/components/instance-detail/snapshot-edit-sheet";

/**
 * Slice 2 (B1) · UI buildPatchBody 在用户清空字段时发 null（而非 undefined）。
 * Slice 1 已让 service 接受 null = clear；此处补 UI 端契约。
 */

describe("Slice 2 · buildPatchBody null=clear 契约", () => {
  it("quiz: timeLimitMinutes/maxQuestions 在 state undefined 时发 null", () => {
    const body = buildPatchBody("quiz", {
      mode: "fixed",
      timeLimitMinutes: undefined,
      maxQuestions: undefined,
      startDifficulty: undefined,
      difficultyStep: undefined,
      questionCount: 0,
    });
    expect(body.taskType).toBe("quiz");
    const cfg = (body as { quizConfig: Record<string, unknown> }).quizConfig;
    expect(cfg.timeLimitMinutes).toBeNull();
    expect(cfg.maxQuestions).toBeNull();
    expect(cfg.startDifficulty).toBeNull();
    expect(cfg.difficultyStep).toBeNull();
  });

  it("quiz: 有值的字段仍按值发", () => {
    const body = buildPatchBody("quiz", {
      mode: "adaptive",
      timeLimitMinutes: 30,
      maxQuestions: 20,
      startDifficulty: 2,
      difficultyStep: 1,
      questionCount: 0,
    });
    const cfg = (body as { quizConfig: Record<string, unknown> }).quizConfig;
    expect(cfg.mode).toBe("adaptive");
    expect(cfg.timeLimitMinutes).toBe(30);
    expect(cfg.maxQuestions).toBe(20);
    expect(cfg.startDifficulty).toBe(2);
    expect(cfg.difficultyStep).toBe(1);
  });

  it("simulation: dialogueRequirements 空字符串发 null", () => {
    const body = buildPatchBody("simulation", {
      scenario: "场景",
      openingLine: "开场",
      dialogueRequirements: "",
      strictnessLevel: "MODERATE",
      scoringCriteria: [],
      allocationCount: 0,
    });
    expect(body.taskType).toBe("simulation");
    const cfg = (body as { simulationConfig: Record<string, unknown> }).simulationConfig;
    expect(cfg.dialogueRequirements).toBeNull();
  });

  it("simulation: dialogueRequirements 仅空格也发 null", () => {
    const body = buildPatchBody("simulation", {
      scenario: "x",
      openingLine: "y",
      dialogueRequirements: "   ",
      strictnessLevel: "MODERATE",
      scoringCriteria: [],
      allocationCount: 0,
    });
    const cfg = (body as { simulationConfig: Record<string, unknown> }).simulationConfig;
    expect(cfg.dialogueRequirements).toBeNull();
  });

  it("simulation: dialogueRequirements 有实际内容仍按值发", () => {
    const body = buildPatchBody("simulation", {
      scenario: "x",
      openingLine: "y",
      dialogueRequirements: "新要求",
      strictnessLevel: "MODERATE",
      scoringCriteria: [],
      allocationCount: 0,
    });
    const cfg = (body as { simulationConfig: Record<string, unknown> }).simulationConfig;
    expect(cfg.dialogueRequirements).toBe("新要求");
  });
});
