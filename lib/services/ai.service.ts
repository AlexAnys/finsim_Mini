import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
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
  weeklyInsight: 0.4,
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
  weeklyInsight: "AI_WEEKLY_INSIGHT",
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

// PR-FIX-2 B2: mood_label 必须是 8 个合法中文标签之一（zod 严格校验）
const VALID_MOOD_LABELS = [
  "平静",
  "放松",
  "兴奋",
  "犹豫",
  "怀疑",
  "略焦虑",
  "焦虑",
  "失望",
] as const;

const chatReplySchema = z.object({
  reply: z.string().min(1),
  mood_score: z.number().min(0).max(1),
  mood_label: z.enum(VALID_MOOD_LABELS),
  student_perf: z.number().min(0).max(1),
  deviated_dimensions: z.array(z.string()).default([]),
});

// PR-FIX-2 B2: NEUTRAL 兜底时同步重写 label 字段（保持 key/label 一致）
const KEY_TO_LABEL: Record<string, string> = {
  HAPPY: "平静",
  RELAXED: "放松",
  EXCITED: "兴奋",
  NEUTRAL: "犹豫",
  SKEPTICAL: "怀疑",
  CONFUSED: "略焦虑",
  ANGRY: "焦虑",
  DISAPPOINTED: "失望",
};

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

/** PR-SIM-3 D3: 学生交互类型。
 *  - user_message: 学生发文字消息（默认行为，与 PR-7B 一致）
 *  - config_submission: 学生把当前资产配置"提交给客户"征求反馈
 */
export type ChatMessageType = "user_message" | "config_submission";

export interface ChatAllocationSection {
  label: string;
  items: Array<{ label: string; value: number }>;
}

export async function chatReply(
  userId: string,
  data: {
    /** PR-FIX-2 B1: optional hint 字段允许服务端从 transcript 自行推导 lastHintTurn（不信任客户端 optional 字段） */
    transcript: Array<{ role: string; text: string; hint?: string }>;
    scenario: string;
    openingLine?: string;
    systemPrompt?: string;
    /** PR-7B: turn index of the most recent hint.
     *  PR-FIX-2 B1: 服务端会自行推导，客户端值仅用于校验/选最大（防客户端漏报刷 token）。 */
    lastHintTurn?: number;
    /** PR-7B: dialog goal hints used for student_perf grading (rubric criteria names) */
    objectives?: string[];
    /** PR-SIM-3 D3: 默认 user_message（学生发文字）；config_submission 表示
     *  学生把当前资产配置交给客户征求反馈，触发客户视角对配置具体项的回应。 */
    messageType?: ChatMessageType;
    /** PR-SIM-3 D3: 当 messageType=config_submission 时必填，学生提交的资产配置快照。 */
    allocations?: ChatAllocationSection[];
  }
): Promise<ChatReplyResult> {
  const messageType: ChatMessageType = data.messageType ?? "user_message";
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

  // PR-SIM-3 D3: 当学生"提交给客户"时，注入额外指令让客户具体回应配置
  const configSubmissionBlock =
    messageType === "config_submission"
      ? `\n【本轮交互类型 · 资产配置提交 · PR-SIM-3】
学生刚刚向你展示了一版资产配置（参见用户消息中的"提交资产配置"段落）。
请基于配置数字 + 已有对话上下文，做出客户视角的具体回应：
- 必须在 reply 中明确提到配置的至少一项具体内容（如"为什么完全不配债券"、"股票从 50% 降到 30%，是出于风险考虑吗？"等）。
- 如果配置与你之前表达的偏好/风险承受能力 / 隐性需求一致，表达认可并追问深层逻辑；如果不一致，礼貌质疑、表达担忧。
- 不要泛泛评价整体（如"看起来不错"），要点名具体项。
- mood_score / mood_label 反映你看到这版配置后的真实情绪变化。
- student_perf 评估学生这版配置是否贴合你已表达的偏好与对话目标。
`
      : "";

  const systemPrompt = `${personaPrompt}
${objectivesBlock}${configSubmissionBlock}
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

  // PR-SIM-3 D3: config_submission 时把学生提交的配置摊平为可读列表，给到客户视角看
  const allocationSubmissionText =
    messageType === "config_submission" && data.allocations && data.allocations.length > 0
      ? `\n\n提交资产配置（学生当前要客户对这版方案的反馈）:\n${data.allocations
          .map((sec) => {
            const lines = sec.items
              .map((it) => `  · ${it.label}: ${it.value}%`)
              .join("\n");
            return `[${sec.label}]\n${lines}`;
          })
          .join("\n")}`
      : "";

  const userPrompt =
    messageType === "config_submission"
      ? `对话历史:\n${conversationHistory}${allocationSubmissionText}\n\n请作为客户对这版资产配置做出具体回应（按上面 JSON 格式输出，reply 必须点名提到配置中至少一项具体内容）。`
      : `对话历史:\n${conversationHistory}\n\n请作为客户继续回复并按上面 JSON 格式输出。`;

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
  // PR-FIX-2 B2: 当降级到 NEUTRAL 时同步重写 label 为"犹豫"，保持 key/label 一致
  const moodLabel = moodKey === "NEUTRAL" && parsed.mood_label !== "犹豫"
    ? KEY_TO_LABEL[moodKey]
    : parsed.mood_label;

  // PR-FIX-2 B1: 服务端从 transcript 自行推导 lastHintTurn（不信任客户端 optional 字段）。
  // 走 transcript 找最近一条带 hint 的 ai 消息，并以"截止该 ai 消息为止的 student-turn 计数"作为 lastHintTurn。
  // 与客户端值取较大者（保守，节流更严，防客户端漏报刷 token）。最终 clamp 到 [0, currentTurn]。
  let serverDerivedLastHintTurn: number | undefined;
  {
    let runningStudentTurns = 0;
    for (const m of data.transcript) {
      if (m.role === "student") runningStudentTurns++;
      if (m.role === "ai" && typeof m.hint === "string" && m.hint.length > 0) {
        serverDerivedLastHintTurn = runningStudentTurns;
      }
    }
  }
  const clientLastHintTurn =
    typeof data.lastHintTurn === "number"
      ? Math.max(0, Math.min(data.lastHintTurn, currentTurn))
      : undefined;
  const effectiveLastHintTurn =
    serverDerivedLastHintTurn !== undefined && clientLastHintTurn !== undefined
      ? Math.max(serverDerivedLastHintTurn, clientLastHintTurn)
      : (serverDerivedLastHintTurn ?? clientLastHintTurn);
  const turnsSinceHint =
    typeof effectiveLastHintTurn === "number"
      ? currentTurn - effectiveLastHintTurn
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
    mood: { score: parsed.mood_score, key: moodKey, label: moodLabel },
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
    assets?: {
      sections: Array<{ label: string; items: Array<{ label: string; value: number }> }>;
      /** PR-7C: chronological snapshots of allocation taken via "记录当前配比" button. */
      snapshots?: Array<{
        turn: number;
        ts: string;
        allocations: Array<{ label: string; value: number }>;
      }>;
    };
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

  const finalAllocations = data.assets
    ? `最终资产配置方案（提交时刻）:\n${JSON.stringify({ sections: data.assets.sections }, null, 2)}\n\n`
    : "";

  const snapshots = data.assets?.snapshots || [];
  const snapshotsBlock =
    snapshots.length > 0
      ? `资产配置演变（共 ${snapshots.length} 次"记录当前配比"快照）:\n${snapshots
          .map(
            (s) =>
              `[第 ${s.turn} 轮 · ${s.ts}] ${s.allocations
                .map((a) => `${a.label}=${a.value}%`)
                .join(", ")}`
          )
          .join("\n")}\n\n请参考资产配置演变：留意学生在对话中根据客户偏好/顾虑的变化是否调整了配置（积极信号），或反复在风险/保守之间摇摆（潜在问题）。把"是否随对话信息更新配置决策"作为"专业度/方案完整性"维度的判分依据之一。\n\n`
      : "";

  const userPrompt = `对话记录:\n${conversationText}\n\n${finalAllocations}${snapshotsBlock}请按照评分标准逐项评估，返回 JSON:
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
