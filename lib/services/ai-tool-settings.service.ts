import { prisma } from "@/lib/db/prisma";

export const AI_TOOL_DEFINITIONS = [
  { key: "simulation", label: "模拟对话", category: "课堂任务", defaultModel: "mimo-v2.5-pro" },
  { key: "studyBuddy", label: "学习伙伴", category: "学生支持", defaultModel: "mimo-v2.5" },
  { key: "taskDraft", label: "任务草稿", category: "课程建设", defaultModel: "mimo-v2.5-pro" },
  { key: "lessonPolish", label: "教案完善", category: "AI 工作助手", defaultModel: "mimo-v2.5-pro" },
  { key: "ideologyMining", label: "思政挖掘", category: "AI 工作助手", defaultModel: "mimo-v2.5-pro" },
  { key: "questionAnalysis", label: "搜题与解析", category: "AI 工作助手", defaultModel: "mimo-v2.5" },
  { key: "examCheck", label: "试卷检查", category: "AI 工作助手", defaultModel: "mimo-v2.5-pro" },
] as const;

export const AI_MODEL_OPTIONS = [
  { value: "mimo-v2.5-pro", label: "高质量", description: "适合复杂教案、思政融合、综合批改" },
  { value: "mimo-v2.5", label: "均衡", description: "适合学习伙伴、题目解析、常规生成" },
  { value: "mimo-v2-flash", label: "快速", description: "适合低成本快速草稿" },
  { value: "mimo-v2-omni", label: "多模态识别", description: "用于图片/试卷识别，需 OCR smoke test 通过" },
] as const;

export async function listAiToolSettings(teacherId: string) {
  const rows = await prisma.aiToolSetting.findMany({
    where: { teacherId },
    orderBy: { toolKey: "asc" },
  });
  const map = new Map(rows.map((row) => [row.toolKey, row]));

  return AI_TOOL_DEFINITIONS.map((definition) => {
    const row = map.get(definition.key);
    return {
      ...definition,
      model: row?.model || definition.defaultModel,
      thinking: row?.thinking || "disabled",
      temperature: row?.temperature ?? null,
      systemPromptSuffix: row?.systemPromptSuffix || "",
      enableSearch: row?.enableSearch ?? false,
      strictness: row?.strictness || "balanced",
      outputStyle: row?.outputStyle || "structured",
      updatedAt: row?.updatedAt || null,
    };
  });
}

export async function upsertAiToolSetting(
  teacherId: string,
  data: {
    toolKey: string;
    model?: string | null;
    thinking?: "disabled" | "enabled";
    temperature?: number | null;
    systemPromptSuffix?: string | null;
    enableSearch?: boolean;
    strictness?: string | null;
    outputStyle?: string | null;
  },
) {
  if (!AI_TOOL_DEFINITIONS.some((tool) => tool.key === data.toolKey)) {
    throw new Error("AI_TOOL_NOT_FOUND");
  }

  return prisma.aiToolSetting.upsert({
    where: {
      teacherId_toolKey: {
        teacherId,
        toolKey: data.toolKey,
      },
    },
    create: {
      teacherId,
      toolKey: data.toolKey,
      model: data.model || null,
      thinking: data.thinking || "disabled",
      temperature: data.temperature ?? null,
      systemPromptSuffix: data.systemPromptSuffix || null,
      enableSearch: data.enableSearch ?? false,
      strictness: data.strictness || null,
      outputStyle: data.outputStyle || null,
    },
    update: {
      model: data.model || null,
      thinking: data.thinking || "disabled",
      temperature: data.temperature ?? null,
      systemPromptSuffix: data.systemPromptSuffix || null,
      enableSearch: data.enableSearch ?? false,
      strictness: data.strictness || null,
      outputStyle: data.outputStyle || null,
    },
  });
}
