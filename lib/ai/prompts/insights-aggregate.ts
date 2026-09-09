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

export const INSIGHTS_AGGREGATE_PROMPT_VERSION = "v2";

export const buildInsightsAggregatePrompt: PromptBuilder<InsightsAggregateOpts> = (opts) => {
  const systemPrompt = `你是一位资深的金融教育课程顾问。基于一组学生提交的 AI 批改反馈，归纳：
1. 仅归纳提供样本的共性问题（最多 5 条），每条包含 title / description / 支持该判断的 evidenceSubmissionIds 数组；不要估算全班人数。
2. 亮点提交（最多 3 条），quote 必须逐字摘自提供的批改反馈（≤80 字），属于 AI 点评，不是学生原话。

输出严格 JSON。不要捏造数据 — 仅基于提供的反馈文本归纳。`;

  const corpus = opts.evaluations
    .slice(0, 50)
    .map(
      (e, i) =>
        `[${i + 1}] submissionId=${e.submissionId} studentName=${e.studentName} score=${e.score} feedback=${e.feedback}`,
    )
    .join("\n");

  const userPrompt = `任务: ${opts.instanceTitle}（${opts.taskType}）
本次分析样本数: ${Math.min(50, opts.evaluations.length)}（每名学生的最新提交；不代表未提供的数据）

学生反馈片段:
${corpus}

请输出 JSON:
{
  "commonIssues": [
    {"title": "标题", "description": "描述", "evidenceSubmissionIds": ["id"]}
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
