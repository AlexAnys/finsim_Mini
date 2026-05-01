import { describe, expect, it } from "vitest";
import { AI_TOOL_DEFINITIONS } from "@/lib/services/ai-tool-settings.service";

describe("AI tool settings catalog", () => {
  it("splits simulation chat and grading into separate teacher-visible settings", () => {
    const map = new Map(AI_TOOL_DEFINITIONS.map((tool) => [tool.key, tool]));

    expect(map.get("simulationChat")?.category).toBe("课堂任务 · 模拟对话");
    expect(map.get("simulationGrading")?.category).toBe("课堂任务 · 模拟对话");
    expect(map.get("simulationChat")?.basePromptPreview).toContain("模拟客户");
    expect(map.get("simulationGrading")?.basePromptPreview).toContain("rubric");
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
    expect(AI_TOOL_DEFINITIONS.every((tool) => tool.basePromptPreview.trim().length > 20)).toBe(true);
  });
});
