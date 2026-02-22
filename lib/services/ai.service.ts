import { createOpenAI } from "@ai-sdk/openai";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import type { AIFeature } from "@/lib/types";

// ============================================
// AI Provider 配置
// ============================================

interface ProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
}

function getProviderConfig(name: string): ProviderConfig | null {
  switch (name) {
    case "qwen":
      return {
        name: "qwen",
        apiKey: process.env.QWEN_API_KEY || "",
        baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        defaultModel: process.env.QWEN_MODEL || "qwen-turbo",
      };
    case "deepseek":
      return {
        name: "deepseek",
        apiKey: process.env.DEEPSEEK_API_KEY || "",
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        defaultModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      };
    case "openai":
      return {
        name: "openai",
        apiKey: process.env.OPENAI_API_KEY || "",
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
      };
    default:
      return null;
  }
}

// Feature -> Temperature 映射
const FEATURE_TEMPERATURES: Record<AIFeature, number> = {
  simulation: 0.9,
  evaluation: 0.3,
  studyBuddyReply: 0.9,
  studyBuddySummary: 0.7,
  quizGrade: 0.3,
  subjectiveGrade: 0.3,
  taskDraft: 0.7,
  importParse: 0.4,
};

// Feature -> 环境变量前缀
const FEATURE_ENV_MAP: Record<AIFeature, string> = {
  simulation: "AI_SIMULATION",
  evaluation: "AI_EVALUATION",
  studyBuddyReply: "AI_STUDY_BUDDY",
  studyBuddySummary: "AI_STUDY_BUDDY",
  quizGrade: "AI_QUIZ_GRADE",
  subjectiveGrade: "AI_SUBJECTIVE_GRADE",
  taskDraft: "AI_TASK_DRAFT",
  importParse: "AI_IMPORT",
};

function getProviderForFeature(feature: AIFeature): { provider: ProviderConfig; model: string } {
  const envPrefix = FEATURE_ENV_MAP[feature];
  const providerName =
    process.env[`${envPrefix}_PROVIDER`] ||
    process.env.AI_PROVIDER ||
    "qwen";
  const model = process.env[`${envPrefix}_MODEL`] || "";

  const provider = getProviderConfig(providerName);
  if (!provider || !provider.apiKey) {
    // 尝试 fallback
    const fallbackName =
      process.env[`${envPrefix}_FALLBACK_PROVIDER`] ||
      process.env.AI_FALLBACK_PROVIDER ||
      "deepseek";
    const fallback = getProviderConfig(fallbackName);
    if (!fallback || !fallback.apiKey) {
      throw new Error(`AI_PROVIDER_NOT_CONFIGURED: ${providerName}`);
    }
    return { provider: fallback, model: model || fallback.defaultModel };
  }

  return { provider, model: model || provider.defaultModel };
}

function createProvider(config: ProviderConfig) {
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

// ============================================
// 限流
// ============================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, feature: AIFeature): boolean {
  if (process.env.AI_RATE_LIMIT_ENABLED !== "true") return true;

  const key = `${userId}:${feature}`;
  const windowMs = parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || "3600000");
  const maxPerFeature = parseInt(process.env.AI_RATE_LIMIT_MAX_PER_FEATURE || "100");
  const now = Date.now();

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxPerFeature) return false;
  entry.count++;
  return true;
}

// ============================================
// JSON 解析鲁棒性
// ============================================

function extractJSON(text: string): string {
  // 去除 markdown 代码块
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
  // 尝试提取 JSON 对象
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : cleaned;
}

// ============================================
// 公共 AI 调用接口
// ============================================

export async function aiGenerateText(
  feature: AIFeature,
  userId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!checkRateLimit(userId, feature)) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  const { provider, model } = getProviderForFeature(feature);
  const openai = createProvider(provider);
  const temperature = FEATURE_TEMPERATURES[feature];

  try {
    const { text } = await generateText({
      model: openai.chat(model),
      system: systemPrompt,
      prompt: userPrompt,
      temperature,
      maxOutputTokens: 4096,
    });

    return text;
  } catch (error) {
    console.error(`[AI ${feature}] provider=${provider.name} model=${model} error:`, error);
    throw error;
  }
}

export async function aiGenerateJSON<T>(
  feature: AIFeature,
  userId: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  maxRetries: number = 2
): Promise<T> {
  if (!checkRateLimit(userId, feature)) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  const { provider, model } = getProviderForFeature(feature);
  const openai = createProvider(provider);
  const temperature = FEATURE_TEMPERATURES[feature];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { text } = await generateText({
        model: openai.chat(model),
        system: systemPrompt + "\n\n请严格返回 JSON 格式，不要包含其他文字。",
        prompt: userPrompt,
        temperature,
        maxOutputTokens: 4096,
      });

      const jsonStr = extractJSON(text);
      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) continue;
    }
  }

  throw lastError || new Error("AI_GENERATE_FAILED");
}

// ============================================
// 模拟对话 - AI 聊天回复
// ============================================

export async function chatReply(
  userId: string,
  data: {
    transcript: Array<{ role: string; text: string }>;
    scenario: string;
    openingLine?: string;
  }
): Promise<string> {
  const systemPrompt = `你是一个金融理财场景中的 AI 客户。请严格按照以下角色设定进行对话：

${data.scenario}

规则：
1. 保持角色一致，不要暴露你是 AI
2. 在每条回复的末尾加上情绪标签：[MOOD: HAPPY|NEUTRAL|ANGRY|CONFUSED|SKEPTICAL]
3. 根据对话质量动态调整情绪
4. 用中文回复，语气自然
5. 如果学生的建议不合理，表现出困惑或怀疑`;

  const conversationHistory = data.transcript
    .map((m) => `${m.role === "student" ? "理财经理" : "客户"}: ${m.text}`)
    .join("\n");

  return aiGenerateText(
    "simulation",
    userId,
    systemPrompt,
    `对话历史:\n${conversationHistory}\n\n请作为客户继续回复：`
  );
}

// ============================================
// 模拟对话 - AI 评估
// ============================================

export async function evaluateSimulation(
  userId: string,
  data: {
    taskName: string;
    requirements?: string;
    scenario: string;
    evaluatorPersona?: string;
    strictnessLevel: string;
    transcript: Array<{ role: string; text: string }>;
    rubric: Array<{ id: string; name: string; description?: string; maxPoints: number }>;
    assets?: { sections: Array<{ label: string; items: Array<{ label: string; value: number }> }> };
  }
) {
  const evaluationSchema = z.object({
    totalScore: z.number(),
    feedback: z.string(),
    rubricBreakdown: z.array(z.object({
      criterionId: z.string(),
      score: z.number(),
      maxScore: z.number(),
      comment: z.string(),
    })),
  });

  const systemPrompt = `${data.evaluatorPersona || "你是一位资深的金融教育评估专家。"}

你正在评估一场模拟理财咨询对话。

任务: ${data.taskName}
${data.requirements ? `要求: ${data.requirements}` : ""}
场景: ${data.scenario}
严格度: ${data.strictnessLevel}

评分标准:
${data.rubric.map((r) => `- ${r.name} (满分${r.maxPoints}分): ${r.description || ""}`).join("\n")}`;

  const conversationText = data.transcript
    .map((m) => `${m.role === "student" ? "理财经理" : "客户"}: ${m.text.replace(/\[MOOD:.*?\]/g, "")}`)
    .join("\n")
    .slice(0, 30000);

  const userPrompt = `对话记录:\n${conversationText}\n\n${
    data.assets
      ? `资产配置方案:\n${JSON.stringify(data.assets, null, 2)}\n\n`
      : ""
  }请按照评分标准逐项评估，返回 JSON:
{
  "totalScore": 总分,
  "feedback": "总体评语",
  "rubricBreakdown": [
    {"criterionId": "标准ID", "score": 得分, "maxScore": 满分, "comment": "评语"}
  ]
}

注意: rubricBreakdown 必须包含恰好 ${data.rubric.length} 项，对应每个评分标准。
criterionId 使用以下 ID: ${data.rubric.map((r) => r.id).join(", ")}`;

  const result = await aiGenerateJSON(
    "evaluation",
    userId,
    systemPrompt,
    userPrompt,
    evaluationSchema
  );

  // 标准化: 确保分数不超上限, 补全缺失项
  const maxScore = data.rubric.reduce((sum, r) => sum + r.maxPoints, 0);
  const breakdown = data.rubric.map((r) => {
    const found = result.rubricBreakdown.find((b) => b.criterionId === r.id);
    return {
      criterionId: r.id,
      score: found ? Math.min(found.score, r.maxPoints) : 0,
      maxScore: r.maxPoints,
      comment: found?.comment || "暂无评语",
    };
  });
  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);

  return {
    totalScore,
    maxScore,
    feedback: result.feedback,
    rubricBreakdown: breakdown,
  };
}
