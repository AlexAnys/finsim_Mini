import type { PromptBuilder } from "./types";

export interface TaskDraftQuizOpts {
  courseName: string;
  chapterName: string;
  prompt?: string;
}

export const TASK_DRAFT_QUIZ_PROMPT_VERSION = "v1";

export const buildTaskDraftQuizPrompt: PromptBuilder<TaskDraftQuizOpts> = (opts) => {
  const systemPrompt =
    "你是一位资深的金融课程出题专家。请根据课程和章节信息生成高质量的测验题目。";

  const userPrompt = `课程: ${opts.courseName}
章节: ${opts.chapterName}
${opts.prompt ? `教师要求: ${opts.prompt}` : ""}

请生成 10 道混合题型的测验题目（包含单选、多选、判断、简答），返回 JSON:
{
  "questions": [
    {
      "type": "single_choice|multiple_choice|true_false|short_answer",
      "prompt": "题目内容",
      "options": [{"id": "A", "text": "选项文本"}],
      "correctOptionIds": ["A"],
      "correctAnswer": "简答题参考答案",
      "points": 1-3,
      "difficulty": 1-3,
      "explanation": "解析"
    }
  ]
}

注意:
- 判断题的 options 为 [{"id":"T","text":"对"},{"id":"F","text":"错"}]
- 简答题不需要 options 和 correctOptionIds
- 每题 points 为 1-3 分
- 使用中文出题`;

  return {
    systemPrompt,
    userPrompt,
    version: TASK_DRAFT_QUIZ_PROMPT_VERSION,
  };
};
