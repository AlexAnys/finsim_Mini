import type { PromptBuilder } from "./types";

export interface StudyBuddySummaryOpts {
  postCount: number;
  /** 学生提问拼成的"\n---\n"分隔字符串 */
  questionsText: string;
}

export const STUDY_BUDDY_SUMMARY_PROMPT_VERSION = "v1";

export const buildStudyBuddySummaryPrompt: PromptBuilder<StudyBuddySummaryOpts> = (opts) => {
  const systemPrompt =
    "你是一位教育数据分析专家。请分析学生们在学习伙伴中提出的问题，找出高频问题和知识盲区。注意识别模式：相似的问题即使措辞不同也应归为同一类。";

  const userPrompt = `以下是 ${opts.postCount} 个学生提问:\n\n${opts.questionsText}\n\n请返回 JSON:
{
  "topQuestions": [{"question": "高频问题", "count": 出现次数, "examples": ["原始问题示例"]}],
  "knowledgeGaps": [{"topic": "知识盲区主题", "description": "描述", "frequency": 出现频率}]
}`;

  return {
    systemPrompt,
    userPrompt,
    version: STUDY_BUDDY_SUMMARY_PROMPT_VERSION,
  };
};
