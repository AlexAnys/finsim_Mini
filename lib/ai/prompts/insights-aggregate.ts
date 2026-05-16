import type { PromptBuilder } from "./types";

export interface InsightsAggregateOpts {
  instanceTitle: string;
  taskType: string;
  evaluations: Array<{
    submissionId: string;
    studentName: string;
    score: number | null;
    feedback: string;
  }>;
}

export const INSIGHTS_AGGREGATE_PROMPT_VERSION = "v1";

export const buildInsightsAggregatePrompt: PromptBuilder<InsightsAggregateOpts> = (opts) => {
  const systemPrompt = `你是一位资深的金融教育课程顾问。基于一组学生提交的 AI 批改反馈，归纳：
1. 全班共性问题（3-5 条），每条包含 title / description / 涉及学生估算数（studentCount）
2. 亮点提交（最多 3 条），每条引用一份提交的学生名字 + 简短引用 (quote ≤80 字)

输出严格 JSON。不要捏造数据 — 仅基于提供的反馈文本归纳。`;

  const corpus = opts.evaluations
    .slice(0, 50)
    .map(
      (e, i) =>
        `[${i + 1}] submissionId=${e.submissionId} studentName=${e.studentName} score=${e.score} feedback=${e.feedback}`,
    )
    .join("\n");

  const userPrompt = `任务: ${opts.instanceTitle}（${opts.taskType}）
学生数: ${opts.evaluations.length}

学生反馈片段:
${corpus}

请输出 JSON:
{
  "commonIssues": [
    {"title": "标题", "description": "描述", "studentCount": 数字}
  ],
  "highlights": [
    {"submissionId": "id", "studentName": "姓名", "quote": "引用"}
  ]
}`;

  return {
    systemPrompt,
    userPrompt,
    version: INSIGHTS_AGGREGATE_PROMPT_VERSION,
  };
};
