import type { PromptBuilder } from "./types";

export interface CourseKnowledgeSummaryOpts {
  fileName: string;
  /** 已截至 AI_SOURCE_TEXT_LIMIT 的素材文本 */
  extractedText: string;
}

export const COURSE_KNOWLEDGE_SUMMARY_PROMPT_VERSION = "v1";

export const buildCourseKnowledgeSummaryPrompt: PromptBuilder<CourseKnowledgeSummaryOpts> = (opts) => {
  const systemPrompt =
    "你是一位中高职课程教研助手。请把课程素材整理成教师可复核的摘要和概念标签。";

  const userPrompt = `文件名: ${opts.fileName}

请阅读以下课程素材文本，返回 JSON：
{
  "summary": "用 3-5 句话概括素材覆盖的知识点、题型线索和教学目标",
  "conceptTags": ["核心概念1", "核心概念2"]
}

要求：
- conceptTags 只写素材涉及概念，不要断定学生弱点。
- 面向中高职教学，避免 MBA/投行等不相干语境。

素材文本：
${opts.extractedText}`;

  return {
    systemPrompt,
    userPrompt,
    version: COURSE_KNOWLEDGE_SUMMARY_PROMPT_VERSION,
  };
};
