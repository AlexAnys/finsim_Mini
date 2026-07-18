import type { PromptBuilder } from "./types";

export type WorkAssistantToolKey = "lessonPolish" | "ideologyMining" | "questionAnalysis" | "examCheck";

export interface WorkAssistantOpts {
  toolKey: WorkAssistantToolKey;
  materialText: string;
  teacherRequest: string;
  outputStyle: string;
  strictness: string;
  extraFields?: Record<string, string>;
  fileReports: Array<{ fileName: string; status: string; error?: string; textLength: number }>;
}

export const WORK_ASSISTANT_PROMPT_VERSION = "v2";

const COMMON_SYSTEM =
  "你是面向中国大陆中高职学校的一线教师工作助手。输出必须可由教师审核后使用，不要虚构材料中未提供的来源；如果缺少来源，请明确写“需教师补充材料/来源”。";

function systemPromptForTool(toolKey: WorkAssistantToolKey): string {
  if (toolKey === "lessonPolish") {
    return `${COMMON_SYSTEM}\n任务：完善教案。关注教学目标、重难点、课堂活动、评价任务、学生差异化支持和板书/话术建议。`;
  }
  if (toolKey === "ideologyMining") {
    return `${COMMON_SYSTEM}\n任务：课程思政挖掘。输出要自然、克制、贴合专业课内容，避免生硬口号，给出融入点、课堂提问和案例表达。`;
  }
  if (toolKey === "questionAnalysis") {
    return `${COMMON_SYSTEM}\n任务：题目解析。识别题型、知识点、解题步骤、易错点、教学提示；对来源不明题目只做解析和教学参考。`;
  }
  return `${COMMON_SYSTEM}\n任务：试卷检查。根据标准答案/评分规则和学生作答进行逐题批改；无法确定时必须标记疑点，不要编造分数依据。`;
}

const EXTRA_FIELD_DEFINITIONS: Record<
  WorkAssistantToolKey,
  Array<{ key: string; label: string }>
> = {
  lessonPolish: [
    { key: "lessonHours", label: "课时" },
    { key: "educationStage", label: "学段" },
    { key: "studentFoundation", label: "学生基础" },
  ],
  ideologyMining: [
    { key: "majorDirection", label: "专业方向" },
    { key: "educationStage", label: "学段" },
  ],
  questionAnalysis: [
    { key: "questionCount", label: "题目数量" },
    { key: "knowledgeScope", label: "知识点范围" },
  ],
  examCheck: [
    { key: "standardAnswer", label: "标准答案" },
    { key: "gradingCriteria", label: "评分标准" },
    { key: "fullScore", label: "满分" },
  ],
};

function extraFieldsForTool(
  toolKey: WorkAssistantToolKey,
  extraFields: Record<string, string> | undefined,
): string {
  const lines = EXTRA_FIELD_DEFINITIONS[toolKey].flatMap(({ key, label }) => {
    const value = extraFields?.[key]?.trim();
    return value ? [`${label}：${value}`] : [];
  });
  if (lines.length === 0) return "";

  const fullScore = toolKey === "examCheck" ? extraFields?.fullScore?.trim() : "";
  const scoreConstraint = fullScore
    ? `\n评分约束：每份学生试卷的各题得分合计不得超过满分“${fullScore}”，任何单题得分也不得超过该满分；无法确定时在 uncertainty 中说明。`
    : "";
  return `\n工具专属输入：\n${lines.join("\n")}${scoreConstraint}`;
}

function outputContractForTool(toolKey: WorkAssistantToolKey): string {
  const commonFields = `  "title": "标题",
  "summary": "总体判断",
  "sections": [
    {
      "heading": "部分名称",
      "diagnosis": "当前问题或判断",
      "suggestions": ["可执行建议"],
      "examples": ["可直接参考的表达、活动或解析"]
    }
  ],
  "actionItems": ["教师下一步可做的动作"],
  "cautions": ["需要教师复核或补充的点"]`;
  if (toolKey !== "examCheck") return `{\n${commonFields}\n}`;

  return `{
${commonFields},
  "gradingTable": [
    {
      "student": "学生/试卷",
      "question": "题号",
      "score": "得分",
      "feedback": "反馈",
      "uncertainty": "不确定点"
    }
  ]
}`;
}

export const buildWorkAssistantPrompt: PromptBuilder<WorkAssistantOpts> = (opts) => {
  const systemPrompt = systemPromptForTool(opts.toolKey);
  const extraFields = extraFieldsForTool(opts.toolKey, opts.extraFields);

  const userPrompt = `工具：${opts.toolKey}
输出风格：${opts.outputStyle}
严格度：${opts.strictness}
教师补充需求：${opts.teacherRequest || "无"}
文件识别报告：${JSON.stringify(opts.fileReports)}${extraFields}

材料：
${opts.materialText || "无"}

请返回 JSON：
${outputContractForTool(opts.toolKey)}`;

  return {
    systemPrompt,
    userPrompt,
    version: WORK_ASSISTANT_PROMPT_VERSION,
  };
};
