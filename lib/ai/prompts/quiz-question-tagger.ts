import type { PromptBuilder } from "./types";

export interface QuizQuestionTaggerOpts {
  /** 待标记题目 block（多行字符串：questionId / 类型 / 题干 / 选项 / 参考答案） */
  questionsBlock: string;
  total: number;
}

export const QUIZ_QUESTION_TAGGER_PROMPT_VERSION = "v1";

export const buildQuizQuestionTaggerPrompt: PromptBuilder<QuizQuestionTaggerOpts> = (opts) => {
  const systemPrompt = `你是一位资深的金融教育专家。为下列测验题目分别提取 1-3 个知识点标签（中文，统一用名词或短语，例如"复利""资产配置""风险偏好"）。
- 标签要尽量复用学科常见术语，避免凭空创造
- 同一标签可以在多道题之间复用
- 标签应该是该题考查的核心概念，不要太宽泛（不要"金融"这种顶层词）`;

  const userPrompt = `共 ${opts.total} 道题需要打标：

${opts.questionsBlock}

请按以下 JSON 格式输出（仅 JSON，无 Markdown）:
{
  "taggings": [
    {"questionId": "题目ID", "tags": ["标签1", "标签2"]}
  ]
}

要求：
- 每题 1-3 个 tags
- questionId 必须用上方提供的 ID
- 全部 ${opts.total} 题都要包含`;

  return {
    systemPrompt,
    userPrompt,
    version: QUIZ_QUESTION_TAGGER_PROMPT_VERSION,
  };
};
