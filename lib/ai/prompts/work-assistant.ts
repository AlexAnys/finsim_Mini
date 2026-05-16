import type { PromptBuilder } from "./types";

export type WorkAssistantToolKey = "lessonPolish" | "ideologyMining" | "questionAnalysis" | "examCheck";

export interface WorkAssistantOpts {
  toolKey: WorkAssistantToolKey;
  materialText: string;
  teacherRequest: string;
  outputStyle: string;
  strictness: string;
  enableSearch: boolean;
  searchConfigured: boolean;
  fileReports: Array<{ fileName: string; status: string; error?: string; textLength: number }>;
}

export const WORK_ASSISTANT_PROMPT_VERSION = "v1";

const COMMON_SYSTEM =
  "你是面向中国大陆中高职学校的一线教师工作助手。输出必须可由教师审核后使用，不要假装已经联网检索；如果缺少来源，请明确写“需教师补充材料/来源”。";

function systemPromptForTool(toolKey: WorkAssistantToolKey): string {
  if (toolKey === "lessonPolish") {
    return `${COMMON_SYSTEM}\n任务：完善教案。关注教学目标、重难点、课堂活动、评价任务、学生差异化支持和板书/话术建议。`;
  }
  if (toolKey === "ideologyMining") {
    return `${COMMON_SYSTEM}\n任务：课程思政挖掘。输出要自然、克制、贴合专业课内容，避免生硬口号，给出融入点、课堂提问和案例表达。`;
  }
  if (toolKey === "questionAnalysis") {
    return `${COMMON_SYSTEM}\n任务：搜题与解析。识别题型、知识点、解题步骤、易错点、教学提示；对来源不明题目只做解析和教学参考。`;
  }
  return `${COMMON_SYSTEM}\n任务：试卷检查。根据标准答案/评分规则和学生作答进行逐题批改；无法确定时必须标记疑点，不要编造分数依据。`;
}

export const buildWorkAssistantPrompt: PromptBuilder<WorkAssistantOpts> = (opts) => {
  const systemPrompt = systemPromptForTool(opts.toolKey);

  const userPrompt = `工具：${opts.toolKey}
输出风格：${opts.outputStyle}
严格度：${opts.strictness}
教师补充需求：${opts.teacherRequest || "无"}
搜索请求：${opts.enableSearch ? (opts.searchConfigured ? "允许使用已配置搜索 provider 的材料" : "教师请求搜索，但系统未配置搜索 provider；请不要假装联网") : "不使用搜索"}
文件识别报告：${JSON.stringify(opts.fileReports)}

材料：
${opts.materialText || "无"}

请返回 JSON：
{
  "title": "标题",
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
  "cautions": ["需要教师复核或补充的点"],
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

  return {
    systemPrompt,
    userPrompt,
    version: WORK_ASSISTANT_PROMPT_VERSION,
  };
};
