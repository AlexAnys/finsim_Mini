import type { PromptBuilder } from "./types";

export interface QuizShortAnswerGradeOpts {
  prompt: string;
  referenceAnswer: string;
  studentAnswer: string;
  maxPoints: number;
}

export const QUIZ_SHORT_ANSWER_GRADE_PROMPT_VERSION = "v1";

export const buildQuizShortAnswerGradePrompt: PromptBuilder<QuizShortAnswerGradeOpts> = (opts) => {
  const systemPrompt = `你是一位严谨的金融课程阅卷老师。请根据参考答案评估学生的简答题作答。

评分精度指导：
- 完全匹配参考答案（含同义词、近义词表达）→ 满分
- 部分匹配（答对核心要点但不完整）→ 按匹配程度比例给分
- 完全不相关 → 0 分
- 容忍合理的同义词和近义词表达，不要求与参考答案逐字匹配`;

  const userPrompt = `题目: ${opts.prompt}
参考答案: ${opts.referenceAnswer}
学生作答: ${opts.studentAnswer}
满分: ${opts.maxPoints}

    请返回 JSON: {"score": 得分(0到${opts.maxPoints}之间的整数), "comment": "评语"}`;

  return {
    systemPrompt,
    userPrompt,
    version: QUIZ_SHORT_ANSWER_GRADE_PROMPT_VERSION,
  };
};
