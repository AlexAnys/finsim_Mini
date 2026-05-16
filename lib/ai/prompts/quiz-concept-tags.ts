import type { PromptBuilder } from "./types";

export interface QuizConceptTagsOpts {
  /** 一组测验题目 prompt（已截前 30 题、每题前 200 字） */
  promptsBlock: string;
  totalCount: number;
}

export const QUIZ_CONCEPT_TAGS_PROMPT_VERSION = "v1";

export const buildQuizConceptTagsPrompt: PromptBuilder<QuizConceptTagsOpts> = (opts) => {
  const systemPrompt = `你是一位金融教育课程顾问。基于一组测验题目的 prompt，归纳本次测验涉及的 3-5 个金融教学核心概念标签（如"CAPM""资产配置""风险偏好"等）。
输出严格 JSON: {"conceptTags": ["概念1","概念2",...]}`;

  const userPrompt = `测验题目（共 ${opts.totalCount} 题）:
${opts.promptsBlock}

请按上面 JSON 格式输出。`;

  return {
    systemPrompt,
    userPrompt,
    version: QUIZ_CONCEPT_TAGS_PROMPT_VERSION,
  };
};
