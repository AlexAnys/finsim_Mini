import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";
import type { AIFeature } from "@/lib/types";

const STORAGE_BASE = (process.env.FILE_STORAGE_PATH || "./public/uploads").replace(/\/+$/, "");
const MATERIAL_TEXT_LIMIT = 24000;
const MAX_JOB_FILES = 12;

export const workAssistantToolKeys = ["lessonPolish", "ideologyMining", "questionAnalysis", "examCheck"] as const;
export type WorkAssistantToolKey = (typeof workAssistantToolKeys)[number];

export const workAssistantResultSchema = z.object({
  title: z.string().default("AI 分析结果"),
  summary: z.string().default(""),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        diagnosis: z.string().optional().default(""),
        suggestions: z.array(z.string()).default([]),
        examples: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  actionItems: z.array(z.string()).default([]),
  cautions: z.array(z.string()).default([]),
  gradingTable: z
    .array(
      z.object({
        student: z.string().optional().default(""),
        question: z.string().optional().default(""),
        score: z.string().optional().default(""),
        feedback: z.string().optional().default(""),
        uncertainty: z.string().optional().default(""),
      }),
    )
    .default([]),
});

export type WorkAssistantResult = z.infer<typeof workAssistantResultSchema> & {
  fallback: boolean;
  fileReports: Array<{ fileName: string; status: string; error?: string; textLength: number }>;
  searchStatus: "disabled" | "configured" | "not_configured";
};

const workAssistantJobInputSchema = z.object({
  toolKey: z.enum(workAssistantToolKeys),
  text: z.string().default(""),
  teacherRequest: z.string().default(""),
  outputStyle: z.string().default("structured"),
  strictness: z.string().default("balanced"),
  enableSearch: z.boolean().default(false),
  files: z
    .array(
      z.object({
        fileName: z.string(),
        filePath: z.string(),
        mimeType: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

export type WorkAssistantJobInput = z.infer<typeof workAssistantJobInputSchema>;

export async function runAiWorkAssistantJob(
  rawInput: unknown,
  userId: string,
  onProgress?: (progress: number) => Promise<void>,
): Promise<WorkAssistantResult> {
  const input = workAssistantJobInputSchema.parse(rawInput || {});
  await onProgress?.(12);

  const extractedParts: string[] = [];
  const fileReports: WorkAssistantResult["fileReports"] = [];
  const files = input.files.slice(0, MAX_JOB_FILES);

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    try {
      const buffer = await readFile(join(STORAGE_BASE, file.filePath));
      const extracted = await extractDocumentText({
        buffer,
        fileName: file.fileName,
        mimeType: file.mimeType,
        allowOcr: true,
      });
      fileReports.push({
        fileName: file.fileName,
        status: extracted.status,
        error: extracted.error,
        textLength: extracted.text.length,
      });
      if (extracted.text) {
        extractedParts.push(`【文件：${file.fileName}】\n${extracted.text}`);
      }
    } catch (err) {
      fileReports.push({
        fileName: file.fileName,
        status: "failed",
        error: errorMessage(err),
        textLength: 0,
      });
    }
    await onProgress?.(12 + Math.round(((index + 1) / Math.max(files.length, 1)) * 48));
  }

  const materialText = [input.text.trim(), ...extractedParts].filter(Boolean).join("\n\n").slice(0, MATERIAL_TEXT_LIMIT);
  if (!materialText && !input.teacherRequest.trim()) {
    throw new Error("WORK_ASSISTANT_EMPTY_INPUT");
  }

  await onProgress?.(68);
  const searchStatus = input.enableSearch
    ? process.env.SEARCH_PROVIDER && process.env.SEARCH_API_KEY
      ? "configured"
      : "not_configured"
    : "disabled";

  try {
    const ai = await aiGenerateJSON(
      featureForTool(input.toolKey),
      userId,
      systemPromptForTool(input.toolKey),
      userPromptForTool({
        toolKey: input.toolKey,
        materialText,
        teacherRequest: input.teacherRequest.trim(),
        outputStyle: input.outputStyle,
        strictness: input.strictness,
        enableSearch: input.enableSearch,
        searchConfigured: searchStatus === "configured",
        fileReports,
      }),
      workAssistantResultSchema,
      1,
    );
    await onProgress?.(94);
    return {
      ...ai,
      fallback: false,
      fileReports,
      searchStatus,
    };
  } catch (err) {
    await onProgress?.(94);
    return {
      ...fallbackResult(input.toolKey, materialText, input.teacherRequest.trim(), err),
      fallback: true,
      fileReports,
      searchStatus: input.enableSearch ? "not_configured" : "disabled",
    };
  }
}

function featureForTool(toolKey: WorkAssistantToolKey): AIFeature {
  return toolKey;
}

function systemPromptForTool(toolKey: WorkAssistantToolKey) {
  const common =
    "你是面向中国大陆中高职学校的一线教师工作助手。输出必须可由教师审核后使用，不要假装已经联网检索；如果缺少来源，请明确写“需教师补充材料/来源”。";
  if (toolKey === "lessonPolish") {
    return `${common}\n任务：完善教案。关注教学目标、重难点、课堂活动、评价任务、学生差异化支持和板书/话术建议。`;
  }
  if (toolKey === "ideologyMining") {
    return `${common}\n任务：课程思政挖掘。输出要自然、克制、贴合专业课内容，避免生硬口号，给出融入点、课堂提问和案例表达。`;
  }
  if (toolKey === "questionAnalysis") {
    return `${common}\n任务：搜题与解析。识别题型、知识点、解题步骤、易错点、教学提示；对来源不明题目只做解析和教学参考。`;
  }
  return `${common}\n任务：试卷检查。根据标准答案/评分规则和学生作答进行逐题批改；无法确定时必须标记疑点，不要编造分数依据。`;
}

function userPromptForTool(input: {
  toolKey: WorkAssistantToolKey;
  materialText: string;
  teacherRequest: string;
  outputStyle: string;
  strictness: string;
  enableSearch: boolean;
  searchConfigured: boolean;
  fileReports: WorkAssistantResult["fileReports"];
}) {
  return `工具：${input.toolKey}
输出风格：${input.outputStyle}
严格度：${input.strictness}
教师补充需求：${input.teacherRequest || "无"}
搜索请求：${input.enableSearch ? (input.searchConfigured ? "允许使用已配置搜索 provider 的材料" : "教师请求搜索，但系统未配置搜索 provider；请不要假装联网") : "不使用搜索"}
文件识别报告：${JSON.stringify(input.fileReports)}

材料：
${input.materialText || "无"}

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
}

function fallbackResult(toolKey: WorkAssistantToolKey, materialText: string, teacherRequest: string, err: unknown) {
  const toolLabel: Record<WorkAssistantToolKey, string> = {
    lessonPolish: "教案完善",
    ideologyMining: "思政挖掘",
    questionAnalysis: "搜题与解析",
    examCheck: "试卷检查",
  };
  return {
    title: `${toolLabel[toolKey]}（离线占位）`,
    summary: "AI 服务暂不可用，系统已完成材料识别。请稍后重试或检查 AI 设置。",
    sections: [
      {
        heading: "已识别材料",
        diagnosis: `已读取 ${materialText.length} 个字符。${teacherRequest ? `教师需求：${teacherRequest}` : ""}`,
        suggestions: ["检查上传材料是否完整", "在 AI 设置中确认模型和账号额度", "必要时缩短材料后重试"],
        examples: [],
      },
    ],
    actionItems: ["稍后重新生成", "确认 OCR/AI provider 配置"],
    cautions: [errorMessage(err)],
    gradingTable: [],
  };
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
