import { prisma } from "@/lib/db/prisma";
import { getProviderConfig, isModelCompatible, resolveFeatureModel, FEATURE_ENV_MAP, FEATURE_TOOL_KEYS } from "./ai.service";
import textModelPolicy from "@/lib/ai/text-model-policy.json";
import { getToolPromptPreview } from "@/lib/ai/prompts/preview";

/**
 * AI 工具元数据（教师 UI `/teacher/ai-settings` 显示）。
 *
 * PR-1 Candidate E (review-ai F-10)：basePromptPreview 不再手写副本（曾与运行时分叉），
 * 改由 `getToolPromptPreview(toolKey)` 派生 — 单源 = `lib/ai/prompts/{feature}` builder。
 */
interface AiToolDefinitionStatic {
  key: string;
  label: string;
  category: string;
  description: string;
}

interface AiToolDefinition extends AiToolDefinitionStatic {
  defaultModel: string;
  /** 运行时派生自 builder.systemPrompt，与真 prompt 单源 */
  basePromptPreview: string;
}

const AI_TOOL_DEFINITIONS_STATIC: AiToolDefinitionStatic[] = [
  {
    key: "simulationChat",
    label: "模拟对话回复",
    category: "课堂任务 · 模拟对话",
    description: "学生对话时的 AI 客户回复、情绪与追问提示。",
  },
  {
    key: "simulationGrading",
    label: "模拟对话批改",
    category: "课堂任务 · 模拟对话",
    description: "模拟对话结束后的 rubric 评分、评语和概念标签。",
  },
  {
    key: "taskDraft",
    label: "课程素材任务草稿",
    category: "课堂任务 · 出题生成",
    description: "任务向导中基于课程素材生成 Quiz、主观题或模拟对话完整草稿。",
  },
  {
    key: "quizDraft",
    label: "Quiz 生成",
    category: "课堂任务 · 出题生成",
    description: "独立 AI 助手入口生成单选、多选、判断、简答混合测验。",
  },
  {
    key: "subjectiveDraft",
    label: "主观题生成",
    category: "课堂任务 · 出题生成",
    description: "独立 AI 助手入口生成主观题任务、参考答案与评分标准。",
  },
  {
    key: "importParse",
    label: "PDF/文档题目导入",
    category: "课堂任务 · 出题生成",
    description: "从 PDF、DOCX、ZIP 等材料识别题目并结构化为题库格式。",
  },
  {
    key: "quizGrade",
    label: "测验简答/标签批改",
    category: "课堂任务 · 批改",
    description: "Quiz 中简答题评分，以及测验概念标签提取。",
  },
  {
    key: "subjectiveGrade",
    label: "主观题批改",
    category: "课堂任务 · 批改",
    description: "主观题提交后的 rubric 评分、评语和概念标签。",
  },
  {
    key: "studyBuddy",
    label: "学习伙伴",
    category: "学生支持",
    description: "学生按课程、章节和任务上下文发起提问后的学习引导与总结。",
  },
  {
    key: "insights",
    label: "任务实例洞察",
    category: "教学洞察",
    description: "基于提交反馈生成班级层面的弱点、建议和复盘摘要。",
  },
  {
    key: "weeklyInsight",
    label: "AI 周洞察",
    category: "教学洞察",
    description: "教师工作台和 Analytics V2 的一周备课洞察。",
  },
  {
    key: "lessonPolish",
    label: "教案完善",
    category: "AI 工作助手",
    description: "上传或粘贴教案后，补充教学目标、活动、评价和课堂话术。",
  },
  {
    key: "ideologyMining",
    label: "思政挖掘",
    category: "AI 工作助手",
    description: "从专业课材料中自然提炼课程思政融合点。",
  },
  {
    key: "questionAnalysis",
    label: "搜题与解析",
    category: "AI 工作助手",
    description: "识别题型、知识点、解题步骤、易错点和教学提示。",
  },
  {
    key: "examCheck",
    label: "试卷检查",
    category: "AI 工作助手",
    description: "上传标准答案、评分规则和学生试卷后辅助批改。",
  },
];

/**
 * 运行时把 static 定义 + 真 builder 派生的 preview 拼成完整 AiToolDefinition。
 * 每次调用都拿"现在 builder 里到底是什么 prompt"，杜绝手写副本漂移。
 */
export const AI_TOOL_DEFINITIONS: AiToolDefinition[] = AI_TOOL_DEFINITIONS_STATIC.map(
  (definition) => ({
    ...definition,
    defaultModel: textModelPolicy.tools[definition.key as keyof typeof textModelPolicy.tools],
    basePromptPreview: getToolPromptPreview(definition.key),
  }),
);

export const AI_MODEL_OPTIONS = [
  { provider: "mimo", value: "mimo-v2.5-pro", label: "高质量", description: "复杂生成" },
  { provider: "mimo", value: "mimo-v2.5", label: "均衡", description: "常规生成" },
  { provider: "mimo", value: "mimo-v2-flash", label: "快速", description: "快速草稿" },
  { provider: "qwen", value: "qwen3-max", label: "通义", description: "常规生成" },
  { provider: "qwen", value: "qwen3.5-plus", label: "通义 Plus", description: "常规生成" },
  { provider: "deepseek", value: "deepseek-v4-flash", label: "DeepSeek Flash", description: "常规生成" },
  { provider: "deepseek", value: "deepseek-v4-pro", label: "DeepSeek Pro", description: "复杂生成" },
  { provider: "gemini", value: "gemini-2.5-flash", label: "Gemini Flash", description: "常规生成" },
  { provider: "openai", value: "gpt-4o-mini", label: "GPT-4o mini", description: "常规生成" },
  { provider: "openai", value: "gpt-4o", label: "GPT-4o", description: "复杂生成" },
] as const;

export function supportsThinking(toolKey: string, provider: string) {
  return ["mimo", "qwen", "deepseek"].includes(provider) &&
    ["simulationGrading", "quizGrade", "subjectiveGrade", "lessonPolish", "ideologyMining"].includes(toolKey);
}

export const AI_PROVIDER_OPTIONS = [
  { value: "mimo", label: "小米 MiMo", description: "兼容选项；语音与部分 OCR 仍使用此服务" },
  { value: "qwen", label: "阿里通义千问", description: "DashScope OpenAI 兼容；中文金融语义稳定" },
  { value: "deepseek", label: "DeepSeek", description: "文本与批改默认；Flash 常规交互，Pro 复杂生成与评分" },
  { value: "gemini", label: "Google Gemini", description: "需 GEMINI_API_KEY；境外网络" },
  { value: "openai", label: "OpenAI", description: "GPT-4o 系列；境外网络 + 付费" },
] as const;

// Fix 4 (review fixes batch 1): provider 真实开放给老师选择。曾经 enum 只放 mimo
// + ai.service 把所有 provider 重写成 mimo（"幽灵设置"），现在恢复真生效。
// 切换 provider 但 .env 缺 key 时，ai.service 走 fallback 链；仍缺 → AI_PROVIDER_NOT_CONFIGURED。
const AI_PROVIDER_VALUES = new Set<string>(AI_PROVIDER_OPTIONS.map((provider) => provider.value));

const LEGACY_TOOL_KEY_FALLBACKS: Record<string, string> = {
  simulationChat: "simulation",
};

export async function listAiToolSettings(teacherId: string) {
  const rows = await prisma.aiToolSetting.findMany({
    where: { teacherId },
    orderBy: { toolKey: "asc" },
  });
  const map = new Map(rows.map((row) => [row.toolKey, row]));

  return AI_TOOL_DEFINITIONS.map((definition) => {
    const row = map.get(definition.key) ?? map.get(LEGACY_TOOL_KEY_FALLBACKS[definition.key] ?? "");
    // 显式教师设置优先；未保存的工具读取环境变量和单源 DeepSeek 文本策略。
    const feature = (Object.keys(FEATURE_TOOL_KEYS) as Array<keyof typeof FEATURE_TOOL_KEYS>).find((key) => FEATURE_TOOL_KEYS[key] === definition.key)!;
    const prefix = FEATURE_ENV_MAP[feature];
    const requestedProvider = row?.provider || process.env[`${prefix}_PROVIDER`] || process.env.AI_PROVIDER || textModelPolicy.provider;
    const provider = AI_PROVIDER_VALUES.has(requestedProvider) ? requestedProvider : textModelPolicy.provider;
    const config = getProviderConfig(provider)!;
    const model = resolveFeatureModel(feature, config, row?.model || process.env[`${prefix}_MODEL`] || "");
    return {
      ...definition,
      provider,
      model,
      thinking: supportsThinking(definition.key, provider) ? (row?.thinking || "disabled") : "disabled",
      thinkingSupported: supportsThinking(definition.key, provider),
      providerConfigured: Boolean(config.apiKey),
      temperature: row?.temperature ?? null,
      systemPromptSuffix: row?.systemPromptSuffix || "",
      enableSearch: false,
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
    provider?: string | null;
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
  if (data.provider && !AI_PROVIDER_VALUES.has(data.provider as (typeof AI_PROVIDER_OPTIONS)[number]["value"])) {
    throw new Error("AI_PROVIDER_NOT_FOUND");
  }

  if (data.provider && data.model) {
    const provider = getProviderConfig(data.provider)!;
    if (!isModelCompatible(provider, data.model)) throw new Error("AI_PROVIDER_MODEL_MISMATCH");
  }
  // These legacy fields are retained in storage for migration compatibility, but have no live controls.
  data.enableSearch = false;
  if (!supportsThinking(data.toolKey, data.provider || process.env.AI_PROVIDER || textModelPolicy.provider)) data.thinking = "disabled";

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
      provider: data.provider || null,
      model: data.model || null,
      thinking: data.thinking || "disabled",
      temperature: data.temperature ?? null,
      systemPromptSuffix: data.systemPromptSuffix || null,
      enableSearch: data.enableSearch ?? false,
      strictness: data.strictness || null,
      outputStyle: data.outputStyle || null,
    },
    update: {
      provider: data.provider || null,
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
