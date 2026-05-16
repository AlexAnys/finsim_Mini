import { describe, it, expect } from "vitest";
import {
  getToolPromptPreview,
  truncatePromptPreview,
} from "@/lib/ai/prompts/preview";
import { AI_TOOL_DEFINITIONS } from "@/lib/services/ai-tool-settings.service";
import { buildSimulationChatPrompt } from "@/lib/ai/prompts/simulation-chat";

describe("AI tool preview derivation (PR-1 E · review-ai F-10)", () => {
  it("truncatePromptPreview cuts at first \\n\\n if shorter than limit", () => {
    const s = "第一段\n\n第二段\n第三行";
    expect(truncatePromptPreview(s, 100)).toBe("第一段\n…（节选；完整 prompt 由系统在运行时拼接）");
  });

  it("truncatePromptPreview cuts at char limit if no paragraph break", () => {
    const s = "无换行长串" + "a".repeat(600);
    const out = truncatePromptPreview(s, 50);
    expect(out.length).toBeLessThan(s.length);
    expect(out).toContain("（节选；完整 prompt 由系统在运行时拼接）");
  });

  it("preview shorter than limit and no \\n\\n → return as-is", () => {
    const s = "短 prompt 一行";
    expect(truncatePromptPreview(s, 100)).toBe(s);
  });

  it("every AI_TOOL_DEFINITIONS toolKey has non-empty preview", () => {
    for (const def of AI_TOOL_DEFINITIONS) {
      expect(def.basePromptPreview.length, def.key).toBeGreaterThan(0);
      expect(def.basePromptPreview, def.key).not.toBe("（预览暂不可用）");
    }
  });

  it("simulationChat preview prefix matches builder.systemPrompt prefix (review-ai F-10 单源)", () => {
    const builderPrompt = buildSimulationChatPrompt({
      scenario: "{scenario}",
      objectives: [],
      messageType: "user_message",
      transcript: [],
    }).systemPrompt;
    const preview = getToolPromptPreview("simulationChat");
    // preview 截到 \n\n 前；builder.systemPrompt 第一段必然以"你是一个金融理财场景中的模拟客户"开头
    expect(builderPrompt.startsWith("你是一个金融理财场景中的模拟客户")).toBe(true);
    expect(preview.startsWith("你是一个金融理财场景中的模拟客户")).toBe(true);
  });

  it("unknown toolKey returns fallback marker", () => {
    expect(getToolPromptPreview("nonExistentTool")).toBe("（预览暂不可用）");
  });
});
