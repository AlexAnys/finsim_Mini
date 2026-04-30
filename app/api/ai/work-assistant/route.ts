import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";
import type { AIFeature } from "@/lib/types";

const toolKeys = ["lessonPolish", "ideologyMining", "questionAnalysis", "examCheck"] as const;
type WorkToolKey = (typeof toolKeys)[number];

const resultSchema = z.object({
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

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const formData = await request.formData();
    const toolKey = formData.get("toolKey") as WorkToolKey | null;
    if (!toolKey || !toolKeys.includes(toolKey)) return validationError("AI 工具类型不正确");

    const pastedText = ((formData.get("text") as string | null) || "").trim();
    const teacherRequest = ((formData.get("teacherRequest") as string | null) || "").trim();
    const outputStyle = ((formData.get("outputStyle") as string | null) || "structured").trim();
    const strictness = ((formData.get("strictness") as string | null) || "balanced").trim();
    const enableSearch = formData.get("enableSearch") === "true";
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    const extractedParts: string[] = [];
    const fileReports: Array<{ fileName: string; status: string; error?: string; textLength: number }> = [];

    for (const file of files.slice(0, 12)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractDocumentText({
        buffer,
        fileName: file.name,
        mimeType: file.type,
        allowOcr: true,
      });
      fileReports.push({
        fileName: file.name,
        status: extracted.status,
        error: extracted.error,
        textLength: extracted.text.length,
      });
      if (extracted.text) {
        extractedParts.push(`【文件：${file.name}】\n${extracted.text}`);
      }
    }

    const materialText = [pastedText, ...extractedParts].filter(Boolean).join("\n\n").slice(0, 24000);
    if (!materialText && !teacherRequest) {
      return validationError("请粘贴内容，或上传文档/试卷后再分析");
    }

    try {
      const ai = await aiGenerateJSON(
        featureForTool(toolKey),
        result.session.user.id,
        systemPromptForTool(toolKey),
        userPromptForTool({
          toolKey,
          materialText,
          teacherRequest,
          outputStyle,
          strictness,
          enableSearch,
          searchConfigured: Boolean(process.env.SEARCH_PROVIDER && process.env.SEARCH_API_KEY),
          fileReports,
        }),
        resultSchema,
        1,
      );
      return success({
        ...ai,
        fallback: false,
        fileReports,
        searchStatus: enableSearch
          ? process.env.SEARCH_PROVIDER && process.env.SEARCH_API_KEY
            ? "configured"
            : "not_configured"
          : "disabled",
      });
    } catch (err) {
      return success({
        ...fallbackResult(toolKey, materialText, teacherRequest, err),
        fallback: true,
        fileReports,
        searchStatus: enableSearch ? "not_configured" : "disabled",
      });
    }
  } catch (err) {
    return handleServiceError(err);
  }
}

function featureForTool(toolKey: WorkToolKey): AIFeature {
  return toolKey;
}

function systemPromptForTool(toolKey: WorkToolKey) {
  const common = `你是面向中国大陆中高职学校的一线教师工作助手。输出必须可由教师审核后使用，不要假装已经联网检索；如果缺少来源，请明确写“需教师补充材料/来源”。`;
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
  toolKey: WorkToolKey;
  materialText: string;
  teacherRequest: string;
  outputStyle: string;
  strictness: string;
  enableSearch: boolean;
  searchConfigured: boolean;
  fileReports: Array<{ fileName: string; status: string; error?: string; textLength: number }>;
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

function fallbackResult(toolKey: WorkToolKey, materialText: string, teacherRequest: string, err: unknown) {
  const toolLabel: Record<WorkToolKey, string> = {
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
    cautions: [err instanceof Error ? err.message : String(err)],
    gradingTable: [],
  };
}
