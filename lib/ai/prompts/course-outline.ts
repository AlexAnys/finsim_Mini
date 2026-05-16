import type { PromptBuilder } from "./types";

export interface CourseOutlineOpts {
  fileName: string;
  /** 完整素材文本（builder 根据 compact 自己截断 / 截到 AI_SOURCE_TEXT_LIMIT） */
  extractedText: string;
  compact: boolean;
}

export const COURSE_OUTLINE_PROMPT_VERSION = "v1";

const COMPACT_LIMIT = 6000;
const FULL_LIMIT = 16000;

export const buildCourseOutlinePrompt: PromptBuilder<CourseOutlineOpts> = (opts) => {
  const systemPrompt =
    "你是一位中高职课程负责人。请只生成可供教师审核的课程目录草稿，不要直接写入系统。";

  const userPrompt = opts.compact
    ? `文件名: ${opts.fileName}

请阅读以下课程素材，返回 JSON 草稿（精简版，只包含核心章节结构）：
{
  "courseGoals": ["课程总体目标"],
  "knowledgeObjectives": ["知识目标"],
  "skillObjectives": ["技能目标"],
  "valueObjectives": ["素养/价值/思政融合目标"],
  "assessmentRequirements": ["考核要求或评价方式"],
  "chapters": [
    {
      "title": "章节标题",
      "order": 0,
      "learningGoals": ["本章学习目标"],
      "knowledgeObjectives": ["本章知识目标"],
      "skillObjectives": ["本章技能目标"],
      "sections": [
        { "title": "小节标题", "order": 0, "knowledgePoints": ["知识点"] }
      ]
    }
  ],
  "globalKnowledgePoints": ["课程级知识点"],
  "notes": ""
}

要求：
- 只输出严格 JSON，不要 Markdown 代码块。
- 每章 sections 最多 5 个，不要写 taskSuggestions / learningGoals 细分（除非素材直接给出）。
- 面向中高职课堂。

素材文本（前 ${COMPACT_LIMIT} 字符）：
${opts.extractedText.slice(0, COMPACT_LIMIT)}`
    : `文件名: ${opts.fileName}

请阅读课程大纲或课程整体内容，返回 JSON：
{
  "courseGoals": ["课程总体目标"],
  "knowledgeObjectives": ["知识目标"],
  "skillObjectives": ["技能目标"],
  "valueObjectives": ["素养/价值/思政融合目标"],
  "assessmentRequirements": ["考核要求或评价方式"],
  "chapters": [
    {
      "title": "章节标题",
      "order": 0,
      "learningGoals": ["本章学习目标"],
      "knowledgeObjectives": ["本章知识目标"],
      "skillObjectives": ["本章技能目标"],
      "sections": [
        {
          "title": "小节标题",
          "order": 0,
          "learningGoals": ["本节学习目标"],
          "knowledgeObjectives": ["本节知识目标"],
          "skillObjectives": ["本节技能目标"],
          "knowledgePoints": ["知识点"],
          "taskSuggestions": [
            {
              "slot": "pre|in|post",
              "taskType": "quiz|simulation|subjective",
              "title": "建议任务标题",
              "rationale": "为什么适合这里"
            }
          ]
        }
      ]
    }
  ],
  "globalKnowledgePoints": ["课程级知识点"],
  "notes": "需要教师确认或补充的地方"
}

要求：
- 只做草稿，不要声称已经改写课程结构。
- 尽量把学习目标、知识目标、技能目标、素养/思政目标、考核要求分开，不要混写成一段话。
- 章节、小节和知识点要面向中高职课堂，不要使用 MBA/投行语境。
- taskSuggestions 只给少量高价值建议，slot 必须是 pre/in/post。

素材文本：
${opts.extractedText.slice(0, FULL_LIMIT)}`;

  return {
    systemPrompt,
    userPrompt,
    version: COURSE_OUTLINE_PROMPT_VERSION,
  };
};
