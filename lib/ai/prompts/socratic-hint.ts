import type { PromptBuilder } from "./types";

export interface SocraticHintOpts {
  scenario: string;
  objectives: string[];
  deviatedDimensions: string[];
  /** 最近 6 轮拼接的"学生: ... / 客户: ..."字符串 */
  recentTranscript: string;
}

export const SOCRATIC_HINT_PROMPT_VERSION = "v1";

export const buildSocraticHintPrompt: PromptBuilder<SocraticHintOpts> = (opts) => {
  const systemPrompt = `你是一位金融教育的学习伙伴。学生（理财顾问）在本轮对话中表现欠佳或偏离了对话目标。
请用 Socratic（苏格拉底）方式给学生一个简短的追问式提示，引导他自己想到改进点 — 不要直接给答案。

要求：
1. 提示长度 18-40 个汉字，单句疑问形式。
2. 中文，口吻像同伴而不是导师。
3. 必须紧扣偏离的目标维度或核心顾虑（不要泛泛而谈）。
4. 严格 JSON 输出: { "hint": "..." }`;

  const userPrompt = `场景: ${opts.scenario}
对话目标: ${opts.objectives.join(" / ") || "（未提供）"}
本轮学生偏离的维度: ${opts.deviatedDimensions.join(" / ") || "（未明确，但 student_perf 偏低）"}

最近 6 轮对话:
${opts.recentTranscript}

请按 Socratic 方式给一句追问式提示。`;

  return {
    systemPrompt,
    userPrompt,
    version: SOCRATIC_HINT_PROMPT_VERSION,
  };
};
