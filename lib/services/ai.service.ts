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
  insights: 0.4,
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
  insights: "AI_INSIGHTS",
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
// 模拟对话 - AI 聊天回复（PR-7B: JSON 输出 + mood + B3 hint trigger）
// ============================================

const MOOD_LABEL_TO_KEY: Record<string, string> = {
  "平静": "HAPPY",
  "放松": "RELAXED",
  "兴奋": "EXCITED",
  "犹豫": "NEUTRAL",
  "怀疑": "SKEPTICAL",
  "略焦虑": "CONFUSED",
  "焦虑": "ANGRY",
  "失望": "DISAPPOINTED",
};

const VALID_MOOD_KEYS = new Set(Object.values(MOOD_LABEL_TO_KEY));

const chatReplySchema = z.object({
  reply: z.string().min(1),
  mood_score: z.number().min(0).max(1),
  mood_label: z.string(),
  student_perf: z.number().min(0).max(1),
  deviated_dimensions: z.array(z.string()).default([]),
});

export interface ChatReplyResult {
  reply: string;
  mood: {
    score: number;
    key: string;
    label: string;
  };
  hint?: string;
  studentPerf: number;
  deviatedDimensions: string[];
  hintTriggered: boolean;
}

export async function chatReply(
  userId: string,
  data: {
    transcript: Array<{ role: string; text: string }>;
    scenario: string;
    openingLine?: string;
    systemPrompt?: string;
    /** PR-7B: turn index of the most recent hint (so service can enforce ">=3 turns since last hint") */
    lastHintTurn?: number;
    /** PR-7B: dialog goal hints used for student_perf grading (rubric criteria names) */
    objectives?: string[];
  }
): Promise<ChatReplyResult> {
  const objectivesBlock =
    data.objectives && data.objectives.length > 0
      ? `\n【对话目标维度】（用作 student_perf 评估与 deviated_dimensions 命名）:\n${data.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n`
      : "";

  const personaPrompt =
    data.systemPrompt?.replace("{scenario}", data.scenario) ||
    `你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：

${data.scenario}

【核心人设 · 中等顽固】
- 你是一个普通人，对理财知识了解不多，但愿意学习和听取专业建议。
- 你有自己的立场与偏好。当理财经理建议明显违背你的风险偏好或财务约束时，你会礼貌但坚定地表达异议，需要对方拿出有说服力的解释才会松动。
- 你会有一些隐性需求（教育金 / 应急金 / 父母赡养 / 家庭目标等），不会一上来全盘托出，而是在对话推进中逐渐透露。
- 你会主动提出与对话目标相关的问题，推动对话朝有意义的方向发展。

【对话风格】
1. 用中文回复，语气自然，像真实客户聊天一样。不要使用 Markdown 符号或列表格式。
2. 每条回复 2-4 句话。可以分享自己的想法、提出疑问、或回应理财经理的建议。
3. 当理财经理解释得好时，表示认可并追问更深入的问题。
4. 当理财经理说得不清楚时，礼貌地请求进一步解释，而不是直接拒绝。
5. 不要一味表达不信任或完全拒绝风险，但也不要对所有建议都立刻同意。

【禁止行为】
- 不要暴露你是 AI 或模拟角色。
- 不要重复理财经理刚说过的话。
- 不要无端制造对抗或拒绝所有建议。`;

  const systemPrompt = `${personaPrompt}
${objectivesBlock}
【输出格式 · 严格 JSON · PR-7B】
请输出严格 JSON（不要包含其他任何文字、不要 Markdown 代码块）：
{
  "reply": "作为客户的中文回复，2-4 句话",
  "mood_score": 0.0,
  "mood_label": "平静",
  "student_perf": 0.0,
  "deviated_dimensions": []
}

字段定义：
- mood_score: 当前你（客户）的情绪强度，0=最平静放松、1=最焦虑失望。与 mood_label 协调一致。
- mood_label 必须从这 8 个中文标签中精确选 1 个：平静 / 放松 / 兴奋 / 犹豫 / 怀疑 / 略焦虑 / 焦虑 / 失望
  · 平静（0.00-0.12）: 无情绪波动
  · 放松（0.12-0.25）: 觉得对方的话有道理、有安全感
  · 兴奋: 仅当对方建议让你眼前一亮、看到新可能
  · 犹豫（0.25-0.40）: 还在思考、信息确认中
  · 怀疑（0.40-0.55）: 觉得对方建议有点不对劲，但还在听
  · 略焦虑（0.55-0.70）: 对方用术语堆砌或建议偏离你的偏好
  · 焦虑（0.70-0.85）: 对方反复忽视你的核心顾虑
  · 失望（0.85-1.00）: 对方让你觉得这次咨询没价值
- student_perf: 评估理财经理（学生）本轮表现，0=极差/答非所问，1=非常专业且贴合目标。
- deviated_dimensions: 学生本轮明显偏离的对话目标维度（从【对话目标维度】中选取名称；没有则空数组）。

不要在 reply 里附加 [MOOD: XXX] 标签 — mood 通过 JSON 字段传递。`;

  const conversationHistory = data.transcript
    .map((m) => `${m.role === "student" ? "理财经理" : "客户"}: ${m.text}`)
    .join("\n");

  const userPrompt = `对话历史:\n${conversationHistory}\n\n请作为客户继续回复并按上面 JSON 格式输出。`;

  const currentTurn = data.transcript.filter((m) => m.role === "student").length;

  let parsed: z.infer<typeof chatReplySchema>;
  try {
    parsed = await aiGenerateJSON(
      "simulation",
      userId,
      systemPrompt,
      userPrompt,
      chatReplySchema
    );
  } catch {
    const fallbackText = await aiGenerateText(
      "simulation",
      userId,
      personaPrompt,
      userPrompt
    );
    return {
      reply: stripMoodTagFromText(fallbackText),
      mood: { score: 0.3, key: "NEUTRAL", label: "犹豫" },
      hint: undefined,
      studentPerf: 0.5,
      deviatedDimensions: [],
      hintTriggered: false,
    };
  }

  const candidateKey = MOOD_LABEL_TO_KEY[parsed.mood_label];
  const moodKey = candidateKey && VALID_MOOD_KEYS.has(candidateKey) ? candidateKey : "NEUTRAL";

  const lastHintTurn = data.lastHintTurn;
  const turnsSinceHint =
    typeof lastHintTurn === "number"
      ? currentTurn - lastHintTurn
      : currentTurn >= 3
        ? 3
        : 0;
  const offTrack =
    parsed.student_perf < 0.5 || parsed.deviated_dimensions.length >= 1;
  const hintTriggered = offTrack && turnsSinceHint >= 3;

  let hint: string | undefined;
  if (hintTriggered) {
    hint = await generateSocraticHint(userId, {
      transcript: data.transcript,
      scenario: data.scenario,
      objectives: data.objectives ?? [],
      deviatedDimensions: parsed.deviated_dimensions,
    });
  }

  return {
    reply: parsed.reply,
    mood: { score: parsed.mood_score, key: moodKey, label: parsed.mood_label },
    hint,
    studentPerf: parsed.student_perf,
    deviatedDimensions: parsed.deviated_dimensions,
    hintTriggered: hintTriggered && !!hint,
  };
}

function stripMoodTagFromText(text: string): string {
  return text.replace(/\[(?:MOOD:\s*)?\w+\]\s*$/i, "").trim();
}

const hintSchema = z.object({ hint: z.string().min(1) });

async function generateSocraticHint(
  userId: string,
  data: {
    transcript: Array<{ role: string; text: string }>;
    scenario: string;
    objectives: string[];
    deviatedDimensions: string[];
  }
): Promise<string | undefined> {
  try {
    const systemPrompt = `你是一位金融教育的学习伙伴。学生（理财顾问）在本轮对话中表现欠佳或偏离了对话目标。
请用 Socratic（苏格拉底）方式给学生一个简短的追问式提示，引导他自己想到改进点 — 不要直接给答案。

要求：
1. 提示长度 18-40 个汉字，单句疑问形式。
2. 中文，口吻像同伴而不是导师。
3. 必须紧扣偏离的目标维度或核心顾虑（不要泛泛而谈）。
4. 严格 JSON 输出: { "hint": "..." }`;

    const recent = data.transcript.slice(-6).map((m) => `${m.role === "student" ? "学生" : "客户"}: ${m.text}`).join("\n");
    const userPrompt = `场景: ${data.scenario}
对话目标: ${data.objectives.join(" / ") || "（未提供）"}
本轮学生偏离的维度: ${data.deviatedDimensions.join(" / ") || "（未明确，但 student_perf 偏低）"}

最近 6 轮对话:
${recent}

请按 Socratic 方式给一句追问式提示。`;

    const out = await aiGenerateJSON(
      "studyBuddyReply",
      userId,
      systemPrompt,
      userPrompt,
      hintSchema
    );
    return out.hint;
  } catch {
    return undefined;
  }
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
    conceptTags: z.array(z.string()).optional(),
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
  ],
  "conceptTags": ["核心概念1", "核心概念2", "核心概念3"]
}

注意:
- rubricBreakdown 必须包含恰好 ${data.rubric.length} 项，对应每个评分标准。
- criterionId 使用以下 ID: ${data.rubric.map((r) => r.id).join(", ")}
- conceptTags 输出本次答卷涉及的 3-5 个金融教学核心概念标签（如"CAPM""资产配置""风险偏好"等），用于后续班级薄弱点聚合。`;

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
    conceptTags: Array.isArray(result.conceptTags) ? result.conceptTags.slice(0, 5) : [],
  };
}
