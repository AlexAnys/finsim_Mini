import { describe, it, expect } from "vitest";
import {
  buildSocraticHintPrompt,
  SOCRATIC_HINT_PROMPT_VERSION,
} from "@/lib/ai/prompts/socratic-hint";

describe("socratic-hint prompt builder (PR-1 E)", () => {
  const opts = {
    scenario: "客户希望规划教育金",
    objectives: ["需求挖掘", "方案合理性"],
    deviatedDimensions: ["需求挖掘"],
    recentTranscript: "学生: 你想要什么\n客户: 不知道",
  };

  it("systemPrompt snapshot", () => {
    expect(buildSocraticHintPrompt(opts).systemPrompt).toMatchSnapshot();
  });

  it("userPrompt snapshot", () => {
    expect(buildSocraticHintPrompt(opts).userPrompt).toMatchSnapshot();
  });

  it("empty objectives → fallback wording", () => {
    const r = buildSocraticHintPrompt({ ...opts, objectives: [] });
    expect(r.userPrompt).toContain("对话目标: （未提供）");
  });

  it("empty deviatedDimensions → fallback wording", () => {
    const r = buildSocraticHintPrompt({ ...opts, deviatedDimensions: [] });
    expect(r.userPrompt).toContain("（未明确，但 student_perf 偏低）");
  });

  it("version v1", () => {
    expect(SOCRATIC_HINT_PROMPT_VERSION).toBe("v1");
  });
});
