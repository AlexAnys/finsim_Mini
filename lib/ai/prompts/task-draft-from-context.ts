import type { PromptBuilder } from "./types";

export interface TaskDraftFromContextOpts {
  taskType: "quiz" | "subjective" | "simulation";
  courseName: string;
  courseDescription: string | null;
  chapterName: string;
  sectionName: string;
  taskName?: string;
  description?: string;
  teacherBrief?: string;
  sources: Array<{
    fileName: string;
    summary: string | null;
    conceptTags: string[];
    text: string;
  }>;
}

export const TASK_DRAFT_FROM_CONTEXT_PROMPT_VERSION = "v1";

export const buildTaskDraftFromContextPrompt: PromptBuilder<TaskDraftFromContextOpts> = (opts) => {
  const typeLabel =
    opts.taskType === "quiz" ? "测验" : opts.taskType === "subjective" ? "主观题" : "模拟对话";

  const systemPrompt = `你是一位面向中高职学校的课程教研与出题助手。请根据课程素材和教师需求生成可由教师审核的${typeLabel}草稿。

边界：
- 不要做跨课程能力诊断，只围绕当前课程/章节/小节。
- 题目和情境要适合中高职课堂，避免 MBA、投行、研究生案例等不相干语境。
- 概念标签只代表素材涉及概念，不要把它们当作学生弱点。
- 返回严格 JSON。`;

  const sourceText = opts.sources
    .map(
      (source, index) => `【素材 ${index + 1}: ${source.fileName}】
摘要：${source.summary || "无"}
概念：${source.conceptTags.join(" / ") || "无"}
正文摘录：
${source.text.slice(0, 6000)}`,
    )
    .join("\n\n");

  const userPrompt = `任务类型：${opts.taskType}
课程：${opts.courseName}
课程描述：${opts.courseDescription || "无"}
章节：${opts.chapterName || "未指定"}
小节：${opts.sectionName || "未指定"}
已有任务名称：${opts.taskName || "未填写"}
已有任务描述：${opts.description || "未填写"}
教师高维需求：${opts.teacherBrief || "未填写"}

课程素材：
${sourceText || "未选择素材，请基于课程/章节/教师需求生成。"}

请返回 JSON：
{
  "taskName": "任务名称",
  "description": "任务说明",
  "totalPoints": 100,
  "timeLimitMinutes": 30,
  "draftNotes": "说明 AI 根据哪些素材和需求填充了哪些字段",
  "quiz": {
    "quizMode": "fixed",
    "showResult": true,
    "questions": [
      {
        "type": "single_choice|multiple_choice|true_false|short_answer",
        "prompt": "题干",
        "options": [{"id": "A", "text": "选项"}],
        "correctOptionIds": ["A"],
        "correctAnswer": "简答参考答案",
        "points": 1,
        "difficulty": 1,
        "explanation": "解析"
      }
    ]
  },
  "subjective": {
    "prompt": "题干",
    "requirements": ["要求1", "要求2"],
    "referenceAnswer": "参考答案",
    "scoringCriteria": [{"name": "评分维度", "description": "评分说明", "maxPoints": 25}]
  },
  "simulation": {
    "scenario": "对话场景",
    "openingLine": "AI 客户开场白",
    "requirements": ["学生需完成的目标"],
    "scoringCriteria": [{"name": "评分维度", "description": "评分说明", "maxPoints": 25}],
    "allocationSections": [{"label": "资产类别", "items": [{"label": "项目", "defaultValue": 0}]}],
    "simPersona": "AI 客户人设",
    "simDialogueStyle": "对话风格",
    "simConstraints": "禁止行为与边界"
  }
}

只填充当前任务类型对应的对象，但保留同一个 JSON 外层结构。`;

  return {
    systemPrompt,
    userPrompt,
    version: TASK_DRAFT_FROM_CONTEXT_PROMPT_VERSION,
  };
};
