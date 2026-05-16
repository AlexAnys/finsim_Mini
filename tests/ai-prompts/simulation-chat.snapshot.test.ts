import { describe, it, expect } from "vitest";
import {
  buildSimulationChatPrompt,
  buildSimulationChatPersona,
  SIMULATION_CHAT_PROMPT_VERSION,
} from "@/lib/ai/prompts/simulation-chat";

const baseOpts = {
  scenario: "一位 35 岁的客户希望规划孩子未来的教育金。",
  objectives: ["了解客户家庭结构", "评估风险偏好", "给出资产配置建议"],
  messageType: "user_message" as const,
  transcript: [
    { role: "ai", text: "你好，我想为孩子准备教育金。" },
    { role: "student", text: "好的，请问孩子目前几岁？" },
  ],
};

describe("simulation-chat prompt builder (PR-1 E)", () => {
  it("default user_message → systemPrompt snapshot", () => {
    const r = buildSimulationChatPrompt(baseOpts);
    expect(r.systemPrompt).toMatchSnapshot();
  });

  it("default user_message → userPrompt snapshot", () => {
    const r = buildSimulationChatPrompt(baseOpts);
    expect(r.userPrompt).toMatchSnapshot();
  });

  it("config_submission → systemPrompt includes injection block", () => {
    const r = buildSimulationChatPrompt({
      ...baseOpts,
      messageType: "config_submission",
      allocations: [
        {
          label: "权益类",
          items: [
            { label: "股票", value: 30 },
            { label: "基金", value: 20 },
          ],
        },
        {
          label: "固收类",
          items: [{ label: "国债", value: 50 }],
        },
      ],
    });
    expect(r.systemPrompt).toMatchSnapshot();
  });

  it("config_submission → userPrompt includes allocations", () => {
    const r = buildSimulationChatPrompt({
      ...baseOpts,
      messageType: "config_submission",
      allocations: [
        {
          label: "权益类",
          items: [{ label: "股票", value: 30 }],
        },
      ],
    });
    expect(r.userPrompt).toMatchSnapshot();
  });

  it("teacher-overridden systemPrompt replaces {scenario}", () => {
    const r = buildSimulationChatPrompt({
      ...baseOpts,
      systemPrompt: "你是客户。场景：{scenario}。请保持中文。",
    });
    expect(r.systemPrompt.startsWith("你是客户。场景：一位 35 岁的客户希望规划孩子未来的教育金。。请保持中文。")).toBe(true);
  });

  it("empty objectives → no objectivesBlock header", () => {
    const r = buildSimulationChatPrompt({ ...baseOpts, objectives: [] });
    expect(r.systemPrompt).not.toContain(
      "【对话目标维度】（用作 student_perf 评估与 deviated_dimensions 命名）",
    );
  });

  it("version is v1", () => {
    expect(SIMULATION_CHAT_PROMPT_VERSION).toBe("v1");
    expect(buildSimulationChatPrompt(baseOpts).version).toBe("v1");
  });

  it("buildSimulationChatPersona returns only persona section (no JSON format block)", () => {
    const persona = buildSimulationChatPersona(baseOpts);
    expect(persona).toContain("你是一个金融理财场景中的模拟客户");
    expect(persona).not.toContain("【输出格式 · 严格 JSON · PR-7B】");
    expect(persona).not.toContain("【对话目标维度】");
  });
});
