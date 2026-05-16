import { describe, expect, it } from "vitest";
import { AI_PROVIDER_OPTIONS, AI_TOOL_DEFINITIONS } from "@/lib/services/ai-tool-settings.service";

describe("AI tool settings catalog", () => {
  it("splits simulation chat and grading into separate teacher-visible settings", () => {
    const map = new Map(AI_TOOL_DEFINITIONS.map((tool) => [tool.key, tool]));

    expect(map.get("simulationChat")?.category).toBe("课堂任务 · 模拟对话");
    expect(map.get("simulationGrading")?.category).toBe("课堂任务 · 模拟对话");
    expect(map.get("simulationChat")?.basePromptPreview).toContain("模拟客户");
    expect(map.get("simulationGrading")?.basePromptPreview).toContain("金融教育评估专家");
  });

  it("exposes separate draft, import, grading, insight and workbench prompts", () => {
    const keys = AI_TOOL_DEFINITIONS.map((tool) => tool.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "taskDraft",
        "quizDraft",
        "subjectiveDraft",
        "importParse",
        "quizGrade",
        "subjectiveGrade",
        "studyBuddy",
        "insights",
        "weeklyInsight",
        "lessonPolish",
        "ideologyMining",
        "questionAnalysis",
        "examCheck",
      ]),
    );
    // PR-1 E: preview 由 builder 派生 + 截到首段。最短情形是 evaluator persona 短句 + 截断尾标。
    expect(AI_TOOL_DEFINITIONS.every((tool) => tool.basePromptPreview.trim().length > 10)).toBe(true);
  });

  it("Fix 4 · 老师可选 5 个 provider（mimo 默认 + qwen/deepseek/gemini/openai）", () => {
    expect(AI_PROVIDER_OPTIONS.map((provider) => provider.value)).toEqual([
      "mimo",
      "qwen",
      "deepseek",
      "gemini",
      "openai",
    ]);
  });
});
