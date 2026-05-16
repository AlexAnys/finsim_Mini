import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";
import type { AIFeature } from "@/lib/types";
import {
  buildWorkAssistantPrompt,
  WORK_ASSISTANT_PROMPT_VERSION,
} from "@/lib/ai/prompts/work-assistant";

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
    const builtPrompt = buildWorkAssistantPrompt({
      toolKey: input.toolKey,
      materialText,
      teacherRequest: input.teacherRequest.trim(),
      outputStyle: input.outputStyle,
      strictness: input.strictness,
      enableSearch: input.enableSearch,
      searchConfigured: searchStatus === "configured",
      fileReports,
    });
    const ai = await aiGenerateJSON(
      featureForTool(input.toolKey),
      userId,
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt,
      workAssistantResultSchema,
      1,
      { promptVersion: WORK_ASSISTANT_PROMPT_VERSION },
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
