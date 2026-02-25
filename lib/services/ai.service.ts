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
        defaultModel: process.env.QWEN_MODEL || "qwen3-max",
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
  studyBuddySummary: 0.9,
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
      providerOptions: {
        openai: { enable_thinking: false },
      },
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
        providerOptions: {
          openai: { enable_thinking: false },
        },
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
    systemPrompt?: string;
  }
): Promise<string> {
  const systemPrompt = (data.systemPrompt?.replace("{scenario}", data.scenario)) || `你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：

${data.scenario}

【核心人设】
- 你是一个普通人，对理财知识了解不多，但愿意学习和听取专业建议。
- 你有自己的顾虑和偏好，但你不是一个"油盐不进"的人。当理财经理给出合理解释时，你会逐渐理解和接受。
- 你会主动提出与对话目标相关的问题，推动对话朝有意义的方向发展。

【对话风格】
1. 用中文回复，语气自然，像真实客户聊天一样。不要使用 Markdown 符号或列表格式。
2. 每条回复 2-4 句话。可以分享自己的想法、提出疑问、或回应理财经理的建议。
3. 当理财经理解释得好时，表示认可并追问更深入的问题。
4. 当理财经理说得不清楚时，礼貌地请求进一步解释，而不是直接拒绝。
5. 不要一味表达不信任或完全拒绝风险。你是来寻求帮助的，不是来刁难人的。

【情绪标签】
在每条回复末尾附加：[MOOD: HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY]
- HAPPY: 理财经理的建议让你觉得有道理、有帮助
- NEUTRAL: 正常交流、信息确认
- CONFUSED: 理财经理用了太多术语或解释不够清楚
- SKEPTICAL: 理财经理的建议明显不符合你的实际情况
- ANGRY: 仅在理财经理反复推销明显不适合的产品时才使用（极少出现）

【禁止行为】
- 不要暴露你是 AI 或模拟角色。
- 不要重复理财经理刚说过的话。
- 不要无端制造对抗或拒绝所有建议。`;

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
严格度说明：
- STRICT / VERY_STRICT: 仅在对话中有明确证据支撑时才给分，推断不计分。
- MODERATE: 合理推断可适当给分，但需注明依据。
- LENIENT: 只要方向正确即可给分，鼓励学生参与。

重要评估原则：
1. 对话中的 [MOOD:] 标签反映了客户的真实情绪反应，请将其作为客户满意度的强信号。ANGRY 出现较多说明理财经理沟通存在严重问题。
2. totalScore 必须等于 rubricBreakdown 中所有 score 之和，不得凭空修改。
3. 评语要具体，引用对话中的原文作为依据。

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
