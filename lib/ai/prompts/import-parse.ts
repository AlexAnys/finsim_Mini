import type { PromptBuilder } from "./types";

export interface ImportParseOpts {
  /** 已经过 15000 字截断的文档文本 */
  truncatedText: string;
}

export const IMPORT_PARSE_PROMPT_VERSION = "v1";

export const buildImportParsePrompt: PromptBuilder<ImportParseOpts> = (opts) => {
  const systemPrompt = `你是一位金融课程题目提取专家。请从以下文档文本中提取所有可以识别的题目，将它们结构化为标准格式。

规则：
1. 识别单选题、多选题、判断题、简答题
2. 选项 id 使用 A, B, C, D 等字母
3. 判断题选项为 [{"id":"T","text":"对"},{"id":"F","text":"错"}]
4. 如果无法确定正确答案，correctOptionIds 留空数组，correctAnswer 留空字符串
5. points 默认 1 分，根据题目复杂度可设为 1-5
6. 使用中文`;

  const userPrompt = `以下是从文档中提取的文本：

${opts.truncatedText}

请提取所有题目并返回 JSON:
{
  "questions": [
    {
      "type": "single_choice|multiple_choice|true_false|short_answer",
      "prompt": "题目内容",
      "options": [{"id": "A", "text": "选项"}],
      "correctOptionIds": ["A"],
      "correctAnswer": "简答参考答案",
      "points": 1,
      "explanation": "解析"
    }
  ]
}`;

  return {
    systemPrompt,
    userPrompt,
    version: IMPORT_PARSE_PROMPT_VERSION,
  };
};
