import type { PromptBuilder } from "./types";

export interface ScopeInsightsDiagnosisOpts {
  /** AI 输入：按 criterion 分组的低分样本（已 JSON 序列化） */
  llmInputJson: string;
}

export const SCOPE_INSIGHTS_DIAGNOSIS_PROMPT_VERSION = "v1";

export const buildScopeInsightsDiagnosisPrompt: PromptBuilder<ScopeInsightsDiagnosisOpts> = (opts) => {
  const systemPrompt =
    "你是一位资深的教学诊断顾问。基于学生在 simulation 模拟对话中的低分维度样本，归纳 3-4 个共性问题。" +
    "每条 title ≤15 字，description ≤80 字，关联 criterion 必须复用输入中的名称，至少 2 个学生证据。" +
    "不要捏造数据，仅基于提供的样本归纳。";

  const userPrompt =
    `以下是 simulation 评分中得分率 < 60% 的样本（按 criterion 分组）：\n\n` +
    opts.llmInputJson +
    `\n\n请输出 JSON: {"commonIssues": [{"title": "...", "description": "...", "frequency": 数字, "relatedCriterion": "...", "evidenceStudentNames": ["学生A", "学生B"]}]}`;

  return {
    systemPrompt,
    userPrompt,
    version: SCOPE_INSIGHTS_DIAGNOSIS_PROMPT_VERSION,
  };
};

export interface ScopeInsightsAdviceOpts {
  /** AI 输入：scope 学情数据（已 JSON 序列化） */
  promptInputJson: string;
}

export const SCOPE_INSIGHTS_ADVICE_PROMPT_VERSION = "v1";

export const buildScopeInsightsAdvicePrompt: PromptBuilder<ScopeInsightsAdviceOpts> = (opts) => {
  const systemPrompt =
    "你是高校金融教育的资深教学顾问。基于教师当前班级 / 课程的学情数据，给出本周教学建议。" +
    "每条 evidence 必须直接引用输入数据中的具体数字、学生名或章节名（不能笼统）。" +
    "中文输出，简明扼要，不要重复输入数据。" +
    "knowledgeGoals 是认知 / 概念层目标（如\"理解风险收益权衡\"）；skillGoals 是能力 / 操作层目标（如\"能完成需求澄清问询、撰写理财建议\"）；二者必须分开输出。";

  const userPrompt =
    "【输入数据】\n" +
    opts.promptInputJson +
    "\n\n请输出 JSON: {\"knowledgeGoals\":[{point,evidence},...3-4 项], \"skillGoals\":[{point,evidence},...2-3 项], \"pedagogyAdvice\":[{method,evidence},...3-4 项], \"focusGroups\":[{group,action,studentNames,evidence},...2-3 项], \"nextSteps\":[{step,evidence},...3-4 项]}";

  return {
    systemPrompt,
    userPrompt,
    version: SCOPE_INSIGHTS_ADVICE_PROMPT_VERSION,
  };
};
