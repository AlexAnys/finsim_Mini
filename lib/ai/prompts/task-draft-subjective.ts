import type { PromptBuilder } from "./types";

export interface TaskDraftSubjectiveOpts {
  courseName: string;
  chapterName: string;
  prompt?: string;
}

export const TASK_DRAFT_SUBJECTIVE_PROMPT_VERSION = "v1";

export const buildTaskDraftSubjectivePrompt: PromptBuilder<TaskDraftSubjectiveOpts> = (opts) => {
  const systemPrompt =
    "你是一位资深的金融课程出题专家。请根据课程信息生成高质量的主观题任务。";

  const userPrompt = `课程: ${opts.courseName}
章节: ${opts.chapterName}
${opts.prompt ? `教师要求: ${opts.prompt}` : ""}

请生成一道主观题任务，返回 JSON:
{
  "taskName": "任务名称",
  "requirements": "任务要求描述",
  "prompt": "给学生看的题目/提示语",
  "referenceAnswer": "参考答案",
  "scoringCriteria": [
    {"name": "评分标准名称", "description": "评分标准描述", "maxPoints": 分值}
  ]
}

注意: 评分标准应该包含 3-5 项，总分 100 分，使用中文。`;

  return {
    systemPrompt,
    userPrompt,
    version: TASK_DRAFT_SUBJECTIVE_PROMPT_VERSION,
  };
};
