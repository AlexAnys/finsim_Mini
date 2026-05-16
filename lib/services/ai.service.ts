import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { z } from "zod";
import type { AIFeature } from "@/lib/types";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";
import {
  buildSimulationChatPrompt,
  buildSimulationChatPersona,
  SIMULATION_CHAT_PROMPT_VERSION,
} from "@/lib/ai/prompts/simulation-chat";
import {
  buildSimulationEvaluatePrompt,
  buildEvidenceRetryHint,
  SIMULATION_EVALUATE_PROMPT_VERSION,
} from "@/lib/ai/prompts/simulation-evaluate";
import {
  buildSocraticHintPrompt,
  SOCRATIC_HINT_PROMPT_VERSION,
} from "@/lib/ai/prompts/socratic-hint";

// ============================================
// AI Provider 配置
// ============================================

interface ProviderConfig {
  name: "mimo" | "qwen" | "deepseek" | "openai" | "gemini";
  apiKey: string;
  baseURL: string;
  defaultModel: string;
}

interface AiRuntimeSetting {
  provider?: string | null;
  model?: string | null;
  thinking?: "disabled" | "enabled" | null;
  temperature?: number | null;
  systemPromptSuffix?: string | null;
}

export interface AiCallOptions {
  settingsUserId?: string | null;
  metadata?: Record<string, unknown>;
  /** Override default 8192. outline / 长 schema 易截断 → 调用方传 16384。 */
  maxOutputTokens?: number;
  /** PR-1 E · prompt builder 的契约版本（如 "v1"）；未迁移 caller 默认 "v1"。 */
  promptVersion?: string;
}

export function getProviderConfig(name: string): ProviderConfig | null {
  switch (name) {
    case "mimo":
      const mimoApiKey = process.env.MIMO_API_KEY || "";
      return {
        name: "mimo",
        apiKey: mimoApiKey,
        baseURL: resolveMimoBaseUrl(mimoApiKey),
        defaultModel: process.env.MIMO_MODEL || "mimo-v2.5-pro",
      };
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
    case "gemini":
      // Gemini 走 OpenAI-compatible adapter（@ai-sdk/google 与 createOpenAI 不兼容签名；
      // 改用 Google 自家 generativelanguage.googleapis.com 的 openai 兼容端点）。
      // GEMINI_PROXY_URL 用于走自建网关/反代，缺省走官方端点。
      return {
        name: "gemini",
        apiKey: process.env.GEMINI_API_KEY || "",
        baseURL:
          process.env.GEMINI_PROXY_URL ||
          "https://generativelanguage.googleapis.com/v1beta/openai/",
        defaultModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      };
    default:
      return null;
  }
}

export function resolveMimoBaseUrl(apiKey = process.env.MIMO_API_KEY || "") {
  const configured = process.env.MIMO_BASE_URL?.trim();
  if (configured) return configured;
  return apiKey.startsWith("tp-")
    ? "https://token-plan-cn.xiaomimimo.com/v1"
    : "https://api.xiaomimimo.com/v1";
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
  quizDraft: 0.7,
  subjectiveDraft: 0.7,
  importParse: 0.4,
  insights: 0.4,
  weeklyInsight: 0.4,
  lessonPolish: 0.55,
  ideologyMining: 0.55,
  questionAnalysis: 0.25,
  examCheck: 0.2,
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
  quizDraft: "AI_QUIZ_DRAFT",
  subjectiveDraft: "AI_SUBJECTIVE_DRAFT",
  importParse: "AI_IMPORT",
  insights: "AI_INSIGHTS",
  weeklyInsight: "AI_WEEKLY_INSIGHT",
  lessonPolish: "AI_LESSON_POLISH",
  ideologyMining: "AI_IDEOLOGY_MINING",
  questionAnalysis: "AI_QUESTION_ANALYSIS",
  examCheck: "AI_EXAM_CHECK",
};

const FEATURE_TOOL_KEYS: Record<AIFeature, string> = {
  simulation: "simulationChat",
  evaluation: "simulationGrading",
  studyBuddyReply: "studyBuddy",
  studyBuddySummary: "studyBuddy",
  quizGrade: "quizGrade",
  subjectiveGrade: "subjectiveGrade",
  taskDraft: "taskDraft",
  quizDraft: "quizDraft",
  subjectiveDraft: "subjectiveDraft",
  importParse: "importParse",
  insights: "insights",
  weeklyInsight: "weeklyInsight",
  lessonPolish: "lessonPolish",
  ideologyMining: "ideologyMining",
  questionAnalysis: "questionAnalysis",
  examCheck: "examCheck",
};

const LEGACY_FEATURE_TOOL_KEYS: Partial<Record<AIFeature, string>> = {
  simulation: "simulation",
};

export function getProviderForFeature(
  feature: AIFeature,
  setting?: AiRuntimeSetting | null,
): { provider: ProviderConfig; model: string } {
  const envPrefix = FEATURE_ENV_MAP[feature];
  const requestedProviderName =
    setting?.provider ||
    process.env[`${envPrefix}_PROVIDER`] ||
    process.env.AI_PROVIDER ||
    "mimo";
  // Fix 4 (review fixes batch 1): 不再把所有 provider 强制改写成 mimo。
  // 历史这里硬 lock 到 MiMo 是因为部署阶段 qwen/deepseek/gemini/openai 配置
  // 不完整，老师在 UI 选了其它 provider 但实际仍走 mimo（"幽灵设置"，对用户
  // 撒谎）。现在 ai-tool-settings.service AI_PROVIDER_OPTIONS 扩到 5 个，
  // .env.example 5 个 key/base_url 都齐备，让 setting 真生效；缺 key 时
  // 走下面的 fallback 链（仍 throw AI_PROVIDER_NOT_CONFIGURED + provider 名）。
  const providerName = requestedProviderName;
  const requestedModel = setting?.model || process.env[`${envPrefix}_MODEL`] || "";

  const provider = getProviderConfig(providerName);
  if (!provider || !provider.apiKey) {
    // Fix 4 (review fixes batch 1): 
    //  - 老师从 UI 选了某 provider 但 .env 缺 key → 走 fallback 链；fallback 也缺 → throw
    //  - 历史"silent 返回 keyless provider"被删（PR 之前这条路径会让 createOpenAI 拿到 apiKey:""
    //    后续在网络层 401，错误信息含糊；现在显式失败，handleServiceError 映射成中文
    //    "AI 服务未配置"。
    const requestedFallbackName =
      process.env[`${envPrefix}_FALLBACK_PROVIDER`] ||
      process.env.AI_FALLBACK_PROVIDER ||
      "mimo";
    // Fix 4: 同样不强制改写 fallback；让 AI_FALLBACK_PROVIDER / AI_<feature>_FALLBACK_PROVIDER 真生效
    const fallbackName = requestedFallbackName;
    const fallback = getProviderConfig(fallbackName);
    if (!fallback || !fallback.apiKey) {
      throw new Error(`AI_PROVIDER_NOT_CONFIGURED: ${providerName}`);
    }
    return {
      provider: fallback,
      model: resolveModelForProvider(fallback, requestedModel),
    };
  }

  return { provider, model: resolveModelForProvider(provider, requestedModel) };
}

function resolveModelForProvider(provider: ProviderConfig, requestedModel: string): string {
  if (!requestedModel) return provider.defaultModel;
  return isModelCompatible(provider, requestedModel)
    ? requestedModel
    : provider.defaultModel;
}

function isModelCompatible(provider: ProviderConfig, model: string): boolean {
  switch (provider.name) {
    case "mimo":
      return model.startsWith("mimo-");
    case "qwen":
      return model.startsWith("qwen");
    case "deepseek":
      return model.startsWith("deepseek");
    case "gemini":
      return model.startsWith("gemini-");
    case "openai":
      // OpenAI / Anthropic 兼容客户端用任意 model id（teacher 在 UI 选好即可）
      return true;
  }
}

function createProvider(config: ProviderConfig) {
  if (config.name === "mimo") {
    // Fix 3 r3 (qa-ai r2 反馈): MiMo `reasoning_effort` 系列参数 (none/low/medium/high)
    // **全部**让 reasoning ON（low 也 ON，只是轻量；上游 14-22s 等 reasoning_content
    // 完成才出 content 首 chunk）。MiMo 真正"reasoning OFF"开关是顶层 body 字段
    // `chat_template_kwargs: {enable_thinking: false}`（curl 实测 OFF 后 1.5s 完成）。
    //
    // @ai-sdk/openai 的白名单 schema 不允许在 body 注入非标准字段，只能从 fetch
    // 拦截层加。仅 MiMo branch — 其它 provider 走原生路径。
    //
    // 注入规则（与 getProviderOptions 对齐）:
    //   - body.reasoning_effort === "low"     → 学生/教师 sync 路径，注入 enable_thinking:false + 删 reasoning_effort（OFF）
    //   - body.reasoning_effort === "high"    → 教师启用 thinking，保留 reasoning_effort（ON）
    //   - body 缺 reasoning_effort            → 不动（默认 reasoning ON）
    return createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      fetch: createMimoFetch(),
    });
  }
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

/**
 * Fix 3 r3 · MiMo-only fetch 拦截器。
 *
 * 把上游 body 解析 → 若 reasoning_effort === "low"（thinking-off 意图），删掉它并
 * 注入 chat_template_kwargs: {enable_thinking: false}（MiMo 真正认得的 OFF 开关）。
 * 其它 reasoning_effort 值（"high"）或没有此字段则透传。
 *
 * 副作用纯局限：只改 chat/completions endpoint 的 JSON body；非 JSON / 非 mimo 路径走原 fetch。
 */
function createMimoFetch(): typeof fetch {
  const baseFetch = globalThis.fetch.bind(globalThis);
  return async function mimoFetch(input, init) {
    if (!init?.body || typeof init.body !== "string") return baseFetch(input, init);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      // body 不是 JSON（multipart/form 等）→ 透传
      return baseFetch(input, init);
    }
    if (typeof body !== "object" || body === null) return baseFetch(input, init);

    const re = body.reasoning_effort;
    if (re === "low") {
      delete body.reasoning_effort;
      const existing = body.chat_template_kwargs;
      body.chat_template_kwargs =
        existing && typeof existing === "object"
          ? { ...(existing as Record<string, unknown>), enable_thinking: false }
          : { enable_thinking: false };
    }
    // re === "high" 或 undefined → 不动 body（reasoning ON）

    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return baseFetch(input, { ...init, body: JSON.stringify(body), headers });
  };
}

// 这些 feature 必须返回严格 JSON。即便 setting/数据库里启了 thinking，也强制
// 关闭 reasoning，避免 reasoning_content 吃光输出 token 导致 content 为空 / JSON 截断。
//
// 加入此集合的判断标准：
//   sync user-facing（学生/教师在等回复，延迟敏感）→ 必须 OFF
//   async batch（grading / summary / draft 后台跑）→ 不进集合，让 thinking 自由
//
// 异步任务即便偶尔 JSON 截断也可重试 / 回退，质量收益 > 偶发失败成本；同步对话
// thinking 拖慢首 token 直接伤 UX。
const JSON_FORCE_DISABLE_THINKING: ReadonlySet<AIFeature> = new Set([
  // 已有：教师 sync 草稿生成（点按钮等返回）
  "weeklyInsight",
  "importParse",
  "questionAnalysis",
  "examCheck",
  "insights",
  "quizDraft",
  "subjectiveDraft",
  "taskDraft",
  // 新增：学生/教师 sync 对话路径（学生在等客户回复 / 在等学习助手回复）
  "simulation",
  "studyBuddyReply",
]);

export function getProviderOptions(
  provider: ProviderConfig,
  setting?: AiRuntimeSetting | null,
  feature?: AIFeature,
) {
  const baseThinking = setting?.thinking || "disabled";
  const thinking = feature && JSON_FORCE_DISABLE_THINKING.has(feature) ? "disabled" : baseThinking;
  if (provider.name === "mimo") {
    // Vercel AI SDK @ai-sdk/openai 的 providerOptions.openai 是白名单 schema，
    // 历史上传的 `thinking: { type: ... }` 不在白名单 → SDK 静默吞掉，从未真正
    // 下发到 MiMo。结果 MiMo v2.5-pro 默认开启 reasoning，所有 sim chat 一直在
    // reasoning 模式跑（直接 curl baseline 实测 reasoning_content 156 bytes / 2.18s；
    // 关掉 reasoning 后 0.24s — 9× 提速）。
    //
    // 修复：用 OpenAI 标准 `reasoningEffort`（在 SDK 白名单内，序列化为
    // `reasoning_effort` 下发到 MiMo）。
    //
    // Fix 3 (review fixes batch 1, qa-ai r1 反馈): MiMo API 在 da9a505 之后
    // 退化了 reasoning_effort 校验 — 'none' 现在返回 400 "Input should be
    // 'low', 'medium' or 'high'"，整条 chat 链路死。直 curl 验证：
    //   * 不传 reasoning_effort → 200 + reasoning ON（默认行为）
    //   * 'low' + stream:true → 200 + SSE 流式输出 + reasoning_tokens ≈ 29
    //   * 'none' → 400
    // 改用 'low' 作为 thinking=disabled 默认：
    //   1) MiMo token-plan 计费按 completion_tokens 不区分 reasoning_tokens；
    //   2) 'low' 下 first chunk 与 'none' 持平（< 0.5s）；
    //   3) 不会回到 reasoning_content 吃光 token 的旧问题。
    return {
      openai: {
        reasoningEffort: thinking === "enabled" ? "high" : "low",
      },
    };
  }

  if (provider.name === "qwen") {
    return {
      openai: { enable_thinking: false },
    };
  }

  return undefined;
}

export async function getRuntimeSetting(userId: string, feature: AIFeature): Promise<AiRuntimeSetting | null> {
  try {
    const select = {
      provider: true,
      model: true,
      thinking: true,
      temperature: true,
      systemPromptSuffix: true,
    } as const;
    const setting = await prisma.aiToolSetting.findUnique({
      where: {
        teacherId_toolKey: {
          teacherId: userId,
          toolKey: FEATURE_TOOL_KEYS[feature],
        },
      },
      select,
    });
    if (setting) return setting;

    const legacyToolKey = LEGACY_FEATURE_TOOL_KEYS[feature];
    if (!legacyToolKey) return null;

    return prisma.aiToolSetting.findUnique({
      where: {
        teacherId_toolKey: {
          teacherId: userId,
          toolKey: legacyToolKey,
        },
      },
      select,
    });
  } catch {
    return null;
  }
}

function mergeSystemPrompt(systemPrompt: string, setting?: AiRuntimeSetting | null) {
  if (!setting?.systemPromptSuffix?.trim()) return systemPrompt;
  return `${systemPrompt}\n\n教师补充要求：\n${setting.systemPromptSuffix.trim()}`;
}

async function createAiRun(input: {
  feature: AIFeature;
  userId: string;
  settingsUserId?: string | null;
  provider: ProviderConfig;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  metadata?: Record<string, unknown>;
  promptVersion?: string;
}) {
  try {
    const promptHash = createHash("sha256")
      .update(`${input.systemPrompt}\n---\n${input.userPrompt}`)
      .digest("hex");
    return await prisma.aiRun.create({
      data: {
        userId: input.userId,
        toolKey: FEATURE_TOOL_KEYS[input.feature],
        feature: input.feature,
        provider: input.provider.name,
        model: input.model,
        status: "running",
        promptVersion: input.promptVersion ?? "v1",
        promptHash,
        inputSize: input.systemPrompt.length + input.userPrompt.length,
        // AI 留痕（Unit 11）：summary 用 userPrompt 前 200 字（明文，方便老师审计而非对哈希）。
        summary: input.userPrompt.slice(0, 200),
        metadata: {
          ...(input.metadata ?? {}),
          effectiveProvider: input.provider.name,
          effectiveModel: input.model,
          settingsUserId: input.settingsUserId ?? input.userId,
        },
      },
    });
  } catch {
    return null;
  }
}

/**
 * Cost estimation per 1k tokens (USD).
 * Source: 主流 provider 公开价目（2026-05 抓取）；缺失模型回退到 null（"未知成本"），
 * 避免把"未估算"误读成"免费"。新模型上线需手工补到本表。
 */
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "qwen-plus": { input: 0.0008, output: 0.002 },
  "qwen-plus-2025-09-11": { input: 0.0008, output: 0.002 },
  "qwen-turbo": { input: 0.0003, output: 0.0006 },
  "qwen-max": { input: 0.0028, output: 0.0084 },
  "deepseek-chat": { input: 0.0003, output: 0.0014 },
  "deepseek-reasoner": { input: 0.00055, output: 0.0022 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gemini-2.0-flash": { input: 0, output: 0 },
  "gemini-1.5-flash": { input: 0, output: 0 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
};

function estimateCostUSD(
  model: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | null {
  const table = COST_PER_1K_TOKENS[model];
  if (!table) return null;
  const it = inputTokens ?? 0;
  const ot = outputTokens ?? 0;
  return (it * table.input + ot * table.output) / 1000;
}

async function finishAiRun(
  runId: string | null | undefined,
  data: {
    status: "succeeded" | "failed";
    startedAt: number;
    output?: string;
    error?: unknown;
    /** Vercel AI SDK 的 usage.inputTokens / outputTokens；缺失视为 null */
    usage?: { inputTokens?: number; outputTokens?: number } | null;
    /** AiRun.summary 用：原始 userPrompt 前 200 字（明文，方便审计）*/
    userPromptForSummary?: string;
    /** AiRun.model — 估算成本用 */
    model?: string;
  },
) {
  if (!runId) return;
  try {
    const inputTokens = data.usage?.inputTokens ?? null;
    const outputTokens = data.usage?.outputTokens ?? null;
    const costEstUSD =
      data.model != null && (inputTokens != null || outputTokens != null)
        ? estimateCostUSD(data.model, inputTokens ?? 0, outputTokens ?? 0)
        : null;
    const summary = data.userPromptForSummary
      ? data.userPromptForSummary.slice(0, 200)
      : undefined;
    await prisma.aiRun.update({
      where: { id: runId },
      data: {
        status: data.status,
        latencyMs: Date.now() - data.startedAt,
        outputSize: data.output?.length,
        error: data.error ? errorMessage(data.error).slice(0, 2000) : null,
        inputTokens,
        outputTokens,
        costEstUSD,
        ...(summary !== undefined ? { summary } : {}),
      },
    });
  } catch {
    // AI 调用日志不能影响主流程。
  }
}

/**
 * PR-1 D: 拿最近一次 AI run 的 model + tokens metadata，供 audit log 使用。
 *
 * 用法：grading.service 在调用 AI 评估前记录 `startedAt = new Date()`，调完后调本函数
 * 拿到 `{ model, inputTokens, outputTokens, runId }` 写入 audit metadata。
 *
 * 设计约束（PR-1 D 决策 Q2 方案 3）：
 * - `since` 必传：限定时间窗 ≤ 5 sec，防止误抓更早的 run
 * - `feature` + `userId` 双重 filter，缩小竞争面
 * - 仍有 race 窗口（同 teacher 同 feature 并发跑两个 AI 调用时）— 见 vitest race test
 *
 * TODO（PR-2 候选 F）：等 aiGenerateText / aiGenerateJSON 重构返回 `{ data, runId, ... }` 后，
 *   本 helper 可删除，audit 直接拿调用返回值更精准。
 */
export async function getLastAiRunMetadata(
  userId: string,
  feature: AIFeature,
  since: Date,
): Promise<{
  runId: string | null;
  model: string | null;
  provider: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
} | null> {
  const FIVE_SEC_MS = 5_000;
  const upperBound = new Date(since.getTime() + FIVE_SEC_MS);
  try {
    const run = await prisma.aiRun.findFirst({
      where: {
        userId,
        feature,
        createdAt: { gte: since, lte: new Date(Math.max(Date.now(), upperBound.getTime())) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, model: true, provider: true, inputTokens: true, outputTokens: true },
    });
    if (!run) return null;
    return {
      runId: run.id,
      model: run.model ?? null,
      provider: run.provider ?? null,
      inputTokens: run.inputTokens ?? null,
      outputTokens: run.outputTokens ?? null,
    };
  } catch {
    return null;
  }
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

// 通过平衡括号扫描，找出第一个完整的顶层 JSON 对象。
// 解决贪心 `\{[\s\S]*\}` 在 thinking 模型输出中跨多个 {...} 截到非法 JSON 的问题。
function extractBalancedJson(text: string): string | null {
  let inString = false;
  let escape = false;
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        return text.slice(start, i + 1);
      }
      if (depth < 0) {
        depth = 0;
        start = -1;
      }
    }
  }
  return null;
}

function extractJSON(text: string): string {
  // 1. 去除 markdown 代码块标记
  const cleaned = text
    .replace(/```(?:json|JSON)?\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  // 2. 平衡括号扫描第一个完整 JSON 对象（覆盖 thinking 模式 reasoning 文本污染）
  const balanced = extractBalancedJson(cleaned);
  if (balanced) return balanced;
  // 3. 兜底：贪心匹配（旧行为，保证不退化已有 case）
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : cleaned;
}

function isJsonShapeError(err: Error): boolean {
  if (err instanceof SyntaxError) return true;
  if (err.name === "ZodError") return true;
  // 其他匹配
  const msg = err.message.toLowerCase();
  return /unexpected (?:end|token)|json|zod/.test(msg);
}

/**
 * M1 (PR #11) · 修复 Molly XLSX outline JSON 截断。
 *
 * MiMo 输出深嵌 outline schema 时常因 maxOutputTokens 截断在 chapters[].sections[]
 * 数组中部，落地 "Expected ',' or ']' after array element in JSON at position N"。
 *
 * 策略（单遍扫描 + 截断恢复）：
 *   1. 从前往后扫描，用栈跟踪 array/object/string 状态。
 *   2. 在每个 "完整 token 边界"（紧随 `,`、`]`、`}`、闭合 `"`，或新 `[`/`{` 开口）
 *      记下 lastSafeEnd —— 截断到此处后栈状态可平凡补齐。
 *   3. 若扫到结尾栈非空，按栈顺序补齐闭合符；先 trim trailing `,`/whitespace。
 *   4. 返回补齐后的字符串；JSON.parse 验证失败返回 null（caller 走 retry）。
 *
 * 注意：本函数只修复"末端截断"，不修复"中段非法 token"。后者由 retry hint 处理。
 */
export function tryRepairTruncatedJSON(raw: string): string | null {
  if (!raw) return null;

  // 先 fast-path：本来就合法直接返回。
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // 继续修复路径
  }

  type StackFrame = "{" | "[" | '"';
  const stack: StackFrame[] = [];
  let escape = false;
  // 安全截断点：满足下述条件之一时记录 (i+1)：
  //   - 容器开口 `[` / `{`（紧随其后即可补齐 ]/}）
  //   - 完整 token 结尾：`,` (后续 trim 掉)、`]`、`}`、闭合 `"`
  //   - 字面值（数字 / true / false / null）后的"清楚结束位置"（其后跟 ,/]/}/whitespace）
  // 这里采用"边界字符到达后记录"的写法：在遇到 ,/]/}/closing-" 时记录。
  // 字面值的处理：扫描到下一个分隔符时再记录。
  let lastSafeEnd = -1;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const top = stack[stack.length - 1];

    // 字符串内部
    if (top === '"') {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        stack.pop();
        lastSafeEnd = i + 1; // 闭合 `"` 是合法边界
      }
      continue;
    }

    // 容器外或值边界
    if (ch === '"') {
      stack.push('"');
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      lastSafeEnd = i + 1; // 紧随 [ / { 后是合法边界（可补 ] / }）
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (top === "{" && ch === "}") stack.pop();
      else if (top === "[" && ch === "]") stack.pop();
      else return null; // 括号不匹配 → 不是单纯截断
      lastSafeEnd = i + 1;
      continue;
    }
    if (ch === ",") {
      // 逗号本身合法的边界（后续 trim 掉）
      lastSafeEnd = i + 1;
      continue;
    }
    if (ch === ":") {
      // 冒号也是合法边界：之后会 trim 掉 ":" 或在 truncated 末尾遇 `:` 时补 `null`。
      lastSafeEnd = i + 1;
      continue;
    }
    // 字面值（数字 / true / false / null）持续中 → lastSafeEnd 不更新。
    // 截断恢复时会被 trim 掉。
  }

  if (stack.length === 0) {
    // 走到这说明 raw 整体已合法但 fast-path 落地失败（不可能）；防御性返回 null。
    return null;
  }

  if (lastSafeEnd <= 0) return null;

  // 截断到 lastSafeEnd
  let truncated = raw.slice(0, lastSafeEnd);

  // Trim trailing 逗号 + 空白（JSON 不允许 trailing comma）
  truncated = truncated.replace(/[,\s]+$/, "");
  if (!truncated) return null;

  // 重新扫一遍 truncated 求当前栈状态（lastSafeEnd 可能漏掉某些边界后的开口）
  const finalStack: StackFrame[] = [];
  let esc = false;
  for (let i = 0; i < truncated.length; i++) {
    const ch = truncated[i];
    const top = finalStack[finalStack.length - 1];
    if (top === '"') {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') finalStack.pop();
      continue;
    }
    if (ch === '"') finalStack.push('"');
    else if (ch === "{" || ch === "[") finalStack.push(ch);
    else if (ch === "}" && top === "{") finalStack.pop();
    else if (ch === "]" && top === "[") finalStack.pop();
  }

  // 若 truncated 末尾刚好是 `"key":` 这种（冒号后没值），补 null
  // 通过检查：在不在字符串内的前提下，扫到的最后一个非空字符是不是 `:`
  // 简单实现：trim 后判断
  let suffix = "";
  // 若顶层是字符串，先补 `"` 关闭
  if (finalStack[finalStack.length - 1] === '"') {
    suffix += '"';
    finalStack.pop();
  }
  // 看 truncated（含已加的 suffix 关闭引号）末尾是否为 `:` —— 是的话补 null
  const probe = (truncated + suffix).replace(/\s+$/, "");
  if (probe.endsWith(":")) {
    suffix += "null";
  }

  // 关闭剩余栈
  while (finalStack.length > 0) {
    const top = finalStack.pop()!;
    if (top === "[") suffix += "]";
    else if (top === "{") suffix += "}";
    else if (top === '"') suffix += '"';
  }

  const repaired = truncated + suffix;
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// ============================================
// 公共 AI 调用接口
// ============================================

export async function aiGenerateText(
  feature: AIFeature,
  userId: string,
  systemPrompt: string,
  userPrompt: string,
  options: AiCallOptions = {},
): Promise<string> {
  if (!checkRateLimit(userId, feature)) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  const settingsUserId = options.settingsUserId || userId;
  const setting = await getRuntimeSetting(settingsUserId, feature);
  const { provider, model } = getProviderForFeature(feature, setting);
  const openai = createProvider(provider);
  const temperature = setting?.temperature ?? FEATURE_TEMPERATURES[feature];
  const mergedSystemPrompt = mergeSystemPrompt(systemPrompt, setting);
  const startedAt = Date.now();
  const aiRun = await createAiRun({
    feature,
    userId,
    settingsUserId,
    provider,
    model,
    systemPrompt: mergedSystemPrompt,
    userPrompt,
    metadata: options.metadata,
    promptVersion: options.promptVersion,
  });

  try {
    const { text, usage } = await generateText({
      model: openai.chat(model),
      system: mergedSystemPrompt,
      prompt: userPrompt,
      temperature,
      maxOutputTokens: 4096,
      providerOptions: getProviderOptions(provider, setting, feature),
    });

    await finishAiRun(aiRun?.id, {
      status: "succeeded",
      startedAt,
      output: text,
      usage,
      model,
    });
    return text;
  } catch (error) {
    await finishAiRun(aiRun?.id, { status: "failed", startedAt, error, model });
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
  maxRetries: number = 2,
  options: AiCallOptions = {},
): Promise<T> {
  if (!checkRateLimit(userId, feature)) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  const settingsUserId = options.settingsUserId || userId;
  const setting = await getRuntimeSetting(settingsUserId, feature);
  const { provider, model } = getProviderForFeature(feature, setting);
  const openai = createProvider(provider);
  const temperature = setting?.temperature ?? FEATURE_TEMPERATURES[feature];
  const mergedSystemPrompt = `${mergeSystemPrompt(systemPrompt, setting)}\n\n请严格返回 JSON 格式，不要包含其他文字。`;
  const startedAt = Date.now();
  const aiRun = await createAiRun({
    feature,
    userId,
    settingsUserId,
    provider,
    model,
    systemPrompt: mergedSystemPrompt,
    userPrompt,
    metadata: options.metadata,
    promptVersion: options.promptVersion,
  });

  let lastError: Error | null = null;
  let lastUsage: { inputTokens?: number; outputTokens?: number } | undefined;

  // M1 (PR #11) · 调用方可覆盖默认 8192：outline / 长 schema 在 8192 易截断 → 16384。
  const maxOutputTokens = options.maxOutputTokens ?? 8192;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 上一轮是 JSON / Schema 失败时，下一轮在 prompt 末尾追加严格 JSON 提示
      const repairHint =
        attempt > 0 && lastError && isJsonShapeError(lastError)
          ? "\n\n上一次返回的 JSON 不完整或包含多余内容，请只输出严格 JSON 对象，不要 Markdown 代码块、不要多余文字。"
          : "";
      const { text, usage: attemptUsage } = await generateText({
        model: openai.chat(model),
        system: mergedSystemPrompt,
        prompt: userPrompt + repairHint,
        temperature,
        // 提高输出上限：weeklyInsight / questionBank 长 prompt 在 4096 容易截断
        maxOutputTokens,
        providerOptions: getProviderOptions(provider, setting, feature),
      });
      lastUsage = attemptUsage;

      const jsonStr = extractJSON(text);
      // M1 · JSON resilient parse：先尝试严格 parse；SyntaxError 时走截断修复再 parse。
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        if (!(parseErr instanceof SyntaxError)) throw parseErr;
        const repaired = tryRepairTruncatedJSON(jsonStr);
        if (!repaired) throw parseErr;
        parsed = JSON.parse(repaired);
      }
      const data = schema.parse(parsed);
      await finishAiRun(aiRun?.id, {
        status: "succeeded",
        startedAt,
        output: text,
        usage: lastUsage,
        model,
      });
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) continue;
    }
  }

  await finishAiRun(aiRun?.id, {
    status: "failed",
    startedAt,
    error: lastError,
    usage: lastUsage,
    model,
  });
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

/**
 * Fix 3 (review fixes batch 1) — 共享 chat prompt 构造。
 * chatReply 与 chatReplyStream 都用同一份 system/user prompt，避免两份漂移。
 */
interface ChatRequestData {
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

function buildChatPrompts(data: ChatRequestData): {
  personaPrompt: string;
  systemPrompt: string;
  userPrompt: string;
  currentTurn: number;
} {
  const messageType: ChatMessageType = data.messageType ?? "user_message";
  const opts = {
    systemPrompt: data.systemPrompt,
    scenario: data.scenario,
    objectives: data.objectives ?? [],
    messageType,
    transcript: data.transcript,
    allocations: data.allocations,
  };
  const { systemPrompt, userPrompt } = buildSimulationChatPrompt(opts);
  const personaPrompt = buildSimulationChatPersona(opts);
  const currentTurn = data.transcript.filter((m) => m.role === "student").length;
  return { personaPrompt, systemPrompt, userPrompt, currentTurn };
}

/**
 * Fix 3 — 把已解析 JSON 转成 ChatReplyResult（mood mapping + hint trigger）。
 * chatReply / chatReplyStream 共享。
 */
async function finalizeChatReply(
  parsed: z.infer<typeof chatReplySchema>,
  data: ChatRequestData,
  userId: string,
  options: AiCallOptions,
): Promise<ChatReplyResult> {
  const candidateKey = MOOD_LABEL_TO_KEY[parsed.mood_label];
  const moodKey = candidateKey && VALID_MOOD_KEYS.has(candidateKey) ? candidateKey : "NEUTRAL";
  // PR-FIX-2 B2: 当降级到 NEUTRAL 时同步重写 label 为"犹豫"，保持 key/label 一致
  const moodLabel = moodKey === "NEUTRAL" && parsed.mood_label !== "犹豫"
    ? KEY_TO_LABEL[moodKey]
    : parsed.mood_label;

  const currentTurn = data.transcript.filter((m) => m.role === "student").length;

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
    }, options);
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

export async function chatReply(
  userId: string,
  data: ChatRequestData,
  options: AiCallOptions = {},
): Promise<ChatReplyResult> {
  const { personaPrompt, systemPrompt, userPrompt } = buildChatPrompts(data);

  const callOptions: AiCallOptions = {
    ...options,
    promptVersion: options.promptVersion ?? SIMULATION_CHAT_PROMPT_VERSION,
  };

  let parsed: z.infer<typeof chatReplySchema>;
  try {
    parsed = await aiGenerateJSON(
      "simulation",
      userId,
      systemPrompt,
      userPrompt,
      chatReplySchema,
      2,
      callOptions,
    );
  } catch {
    const fallbackText = await aiGenerateText(
      "simulation",
      userId,
      personaPrompt,
      userPrompt,
      callOptions,
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

  return finalizeChatReply(parsed, data, userId, options);
}

// ============================================
// 模拟对话 - AI 聊天回复 · 流式输出（Fix 3 · review fixes batch 1）
// ============================================

/** Fix 3 · 30 秒上限。MiMo p95 单轮 < 15s（即便 thinking ON 也 < 25s），
 *  超过认为是上游卡顿，前端必须看到中文超时提示而不是无止境的 loading。 */
export const CHAT_STREAM_TIMEOUT_MS = 30_000;

/** Fix 3 · 流式 chat 返回值。
 *  - `replyStream`: 逐 chunk 解出来的 reply 文本流（剥离 JSON 包装），前端 SSE 边收边渲染。
 *  - `meta()`: 等 stream 跑完后返回 mood / hint / studentPerf。失败回退 NEUTRAL/0.5/degraded=true。
 */
export interface ChatReplyStreamResult {
  replyStream: AsyncIterable<string>;
  meta: () => Promise<{
    reply: string;
    mood: { score: number; key: string; label: string };
    hint?: string;
    studentPerf: number;
    deviatedDimensions: string[];
    hintTriggered: boolean;
    /** true = JSON 解析失败兜底（与 chatReply 行为一致）。前端 logger 可降权。 */
    degraded: boolean;
  }>;
}

/**
 * 流式版 chatReply。
 * - 用 `streamText` 拉 raw text 流，本质是模型输出的 JSON。
 * - 边读边用 `parsePartialJson` 取 reply 增量，吐给调用方做 SSE 渲染。
 * - 流结束后用 chatReplySchema 严格校验，校验失败 / 超时 → 走 chatReply 同款 NEUTRAL 兜底。
 *
 * 不破坏 chatReply 任何契约：调用方（chat route）若 stream 渠道不可用可继续走 chatReply。
 */
export async function chatReplyStream(
  userId: string,
  data: ChatRequestData,
  options: AiCallOptions = {},
): Promise<ChatReplyStreamResult> {
  const { systemPrompt, userPrompt } = buildChatPrompts(data);

  if (!checkRateLimit(userId, "simulation")) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  const settingsUserId = options.settingsUserId || userId;
  const setting = await getRuntimeSetting(settingsUserId, "simulation");
  const { provider, model } = getProviderForFeature("simulation", setting);
  const openai = createProvider(provider);
  const temperature = setting?.temperature ?? FEATURE_TEMPERATURES["simulation"];
  const mergedSystemPrompt = `${mergeSystemPrompt(systemPrompt, setting)}\n\n请严格返回 JSON 格式，不要包含其他文字。`;
  const startedAt = Date.now();
  const aiRun = await createAiRun({
    feature: "simulation",
    userId,
    settingsUserId,
    provider,
    model,
    systemPrompt: mergedSystemPrompt,
    userPrompt,
    metadata: { ...(options.metadata ?? {}), streaming: true },
    promptVersion: options.promptVersion ?? SIMULATION_CHAT_PROMPT_VERSION,
  });

  // Fix 3 · 30s AbortController 上限。模型卡死时主动断流，前端走中文超时分支。
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), CHAT_STREAM_TIMEOUT_MS);

  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model: openai.chat(model),
      system: mergedSystemPrompt,
      prompt: userPrompt,
      temperature,
      maxOutputTokens: 4096,
      providerOptions: getProviderOptions(provider, setting, "simulation"),
      abortSignal: abortController.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    await finishAiRun(aiRun?.id, { status: "failed", startedAt, error: err, model });
    throw err;
  }

  // 共享状态：generator 边读 stream 边累积 raw、抽 reply 增量推给前端；
  // meta() 收尾时再把 raw 整体 parse 出 mood/student_perf。
  //
  // Fix 3 r2 (qa-ai 反馈): 历史用空 IIFE 的 streamDone 等于立即 resolve，
  // 起不到"等 generator 跑完"作用。改成 deferred Promise，由 generator finally 里
  // resolve。当前实际 SSE 路径里 route 先 `for await replyStream` 后再调 meta()，
  // 行为没问题；但代码契约必须按字面意思工作，否则后人改顺序会踩坑。
  let rawAccum = "";
  let lastReplyEmitted = "";
  let streamError: unknown = null;
  let streamFinished = false;
  let resolveStreamDone: () => void = () => {};
  const streamDone: Promise<void> = new Promise((resolve) => {
    resolveStreamDone = resolve;
  });

  async function* replyChunks(): AsyncGenerator<string> {
    try {
      for await (const chunk of result.textStream) {
        rawAccum += chunk;
        // 增量 parse partial JSON，取出 reply 字段的当前值
        const parsedReply = await tryExtractReplyFromPartial(rawAccum);
        if (parsedReply !== null && parsedReply.length > lastReplyEmitted.length) {
          const delta = parsedReply.slice(lastReplyEmitted.length);
          lastReplyEmitted = parsedReply;
          if (delta) yield delta;
        }
      }
      streamFinished = true;
    } catch (err) {
      streamError = err;
      streamFinished = true;
      // 异常上抛到 generator 调用者（SSE writer 会捕获并发降级 chunk）
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
      resolveStreamDone();
    }
  }

  async function meta() {
    if (!streamFinished) {
      // generator 没被消费完 → 主动拉一遍剩余 textStream（极端 case：caller 直接调 meta 没拿 replyChunks）
      try {
        for await (const chunk of result.textStream) rawAccum += chunk;
        streamFinished = true;
      } catch (err) {
        streamError = err;
      } finally {
        clearTimeout(timeoutHandle);
        resolveStreamDone();
      }
    }
    // 等 generator 真正跑完（finally 里 resolveStreamDone() 已触发；为了"先调 meta"
    // 的极端用法 await 一下保证 rawAccum 不被并发竞争）
    await streamDone;

    // Stream 已结束：从 result.totalUsage 拉 token usage（Vercel AI SDK 在 onFinish 后 resolve）。
    let streamUsage: { inputTokens?: number; outputTokens?: number } | undefined;
    try {
      const u = await result.totalUsage;
      streamUsage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens };
    } catch {
      // usage 拉不到不阻塞主流程（AiRun 留 null tokens）。
    }

    if (streamError) {
      await finishAiRun(aiRun?.id, {
        status: "failed",
        startedAt,
        error: streamError,
        usage: streamUsage,
        model,
      });
      return degradedFallback(rawAccum);
    }

    // 严格 parse → 失败兜底
    try {
      const jsonStr = extractJSON(rawAccum);
      const parsedJson = JSON.parse(jsonStr);
      const parsed = chatReplySchema.parse(parsedJson);
      await finishAiRun(aiRun?.id, {
        status: "succeeded",
        startedAt,
        output: rawAccum,
        usage: streamUsage,
        model,
      });
      const finalized = await finalizeChatReply(parsed, data, userId, options);
      return { ...finalized, degraded: false };
    } catch (err) {
      await finishAiRun(aiRun?.id, {
        status: "failed",
        startedAt,
        error: err,
        usage: streamUsage,
        model,
      });
      return degradedFallback(rawAccum);
    }
  }

  return { replyStream: replyChunks(), meta };
}

/** Fix 3 · 严格 JSON 解析失败时的兜底。
 *  与 chatReply 失败兜底语义一致：reply=尽量从 raw 拼出来 / stripMoodTag，mood=犹豫 NEUTRAL，studentPerf=0.5。
 */
function degradedFallback(rawAccum: string) {
  // 尝试从 raw 抽 reply；抽不到就把整个 raw 当 reply（剥掉 JSON 大括号 / [MOOD:] tag）。
  let bestReply = "";
  try {
    const jsonStr = extractJSON(rawAccum);
    const obj = JSON.parse(jsonStr);
    if (obj && typeof obj.reply === "string") bestReply = obj.reply;
  } catch {
    // 直接清洗 raw
    bestReply = stripMoodTagFromText(
      rawAccum.replace(/^\s*\{[^\}]*"reply"\s*:\s*"/i, "").replace(/"\s*,[\s\S]*$/, "").trim(),
    );
  }
  if (!bestReply) bestReply = stripMoodTagFromText(rawAccum);

  return {
    reply: bestReply || "客户暂时没有回应，请稍后再试。",
    mood: { score: 0.3, key: "NEUTRAL", label: "犹豫" },
    hint: undefined as string | undefined,
    studentPerf: 0.5,
    deviatedDimensions: [] as string[],
    hintTriggered: false,
    degraded: true,
  };
}

/** Fix 3 · 从 partial JSON 取 reply 字段。
 *  partial 的 JSON 在流式途中往往不完整（"reply": "客户说..." 还没收尾 `"`）。
 *  `parsePartialJson` 会在最大可解析处停下，返回部分对象；取它的 reply 字段。
 */
async function tryExtractReplyFromPartial(raw: string): Promise<string | null> {
  // 先快速字符串解析，避免每个 chunk 都走 AI SDK 的 partial parser（最热路径）。
  // 简单 substring 匹配 `"reply": "...` 取已经收到的 reply 字符。
  const fastIdx = raw.indexOf('"reply"');
  if (fastIdx < 0) return null;
  // 找到 reply 字段之后的第一个 `"`（值开头）
  const valueOpen = raw.indexOf('"', raw.indexOf(':', fastIdx) + 1);
  if (valueOpen < 0) return null;
  // 沿值字符串前进，遇到未转义的 `"` 即终止；否则到 raw 末尾（部分输出）。
  let i = valueOpen + 1;
  let buf = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      // JSON 转义
      const next = raw[i + 1];
      if (next === undefined) break;
      if (next === '"') buf += '"';
      else if (next === "\\") buf += "\\";
      else if (next === "n") buf += "\n";
      else if (next === "t") buf += "\t";
      else if (next === "r") buf += "\r";
      else if (next === "u" && i + 5 < raw.length) {
        const code = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(code)) {
          buf += String.fromCharCode(parseInt(code, 16));
          i += 6;
          continue;
        } else buf += next;
      } else buf += next;
      i += 2;
      continue;
    }
    if (ch === '"') break; // 值结束
    buf += ch;
    i += 1;
  }
  return buf || null;
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
  },
  options: AiCallOptions = {},
): Promise<string | undefined> {
  try {
    const recent = data.transcript.slice(-6).map((m) => `${m.role === "student" ? "学生" : "客户"}: ${m.text}`).join("\n");
    const builtHint = buildSocraticHintPrompt({
      scenario: data.scenario,
      objectives: data.objectives,
      deviatedDimensions: data.deviatedDimensions,
      recentTranscript: recent,
    });

    const out = await aiGenerateJSON(
      "studyBuddyReply",
      userId,
      builtHint.systemPrompt,
      builtHint.userPrompt,
      hintSchema,
      2,
      { ...options, promptVersion: options.promptVersion ?? SOCRATIC_HINT_PROMPT_VERSION },
    );
    return out.hint;
  } catch {
    return undefined;
  }
}

// ============================================
// 模拟对话 - AI 评估
// ============================================

/**
 * Unit 9 · 计算 rubric 评估输出中"找不到对应原句"的 evidence 条数。
 *
 * studentText 为空字符串视为"AI 主动声明无可引用"，不算 mismatch。
 */
export function countMismatchedEvidence(
  rubricBreakdown: Array<{ evidence?: Array<{ studentText: string }> }>,
  transcriptText: string,
): number {
  let n = 0;
  for (const r of rubricBreakdown) {
    for (const ev of r.evidence ?? []) {
      if (ev.studentText && !transcriptText.includes(ev.studentText)) {
        n++;
      }
    }
  }
  return n;
}

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
  },
  options: AiCallOptions = {},
) {
  const evaluationSchema = z.object({
    totalScore: z.number(),
    feedback: z.string(),
    rubricBreakdown: z.array(z.object({
      criterionId: z.string(),
      score: z.number(),
      maxScore: z.number(),
      comment: z.string(),
      // Unit 9: evidence — 每项 rubric 至少 1 条引用学生原句的依据
      evidence: z
        .array(
          z.object({
            studentText: z.string(),
            comment: z.string(),
          }),
        )
        .default([]),
    })),
    conceptTags: z.array(z.string()).optional(),
  });

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

  const builtEval = buildSimulationEvaluatePrompt({
    taskName: data.taskName,
    requirements: data.requirements,
    scenario: data.scenario,
    evaluatorPersona: data.evaluatorPersona,
    strictnessLevel: data.strictnessLevel,
    rubric: data.rubric,
    transcriptText: conversationText,
    finalAllocations,
    snapshotsBlock,
  });
  const systemPrompt = builtEval.systemPrompt;
  const userPrompt = builtEval.userPrompt;

  // Unit 9: 学生原句池（用于 evidence 引用校验）
  const studentTextPool = data.transcript
    .filter((m) => m.role === "student")
    .map((m) => m.text.replace(/\[MOOD:.*?\]/g, "").trim());
  const joinedStudentText = studentTextPool.join("\n");

  const evalCallOptions: AiCallOptions = {
    ...options,
    promptVersion: options.promptVersion ?? SIMULATION_EVALUATE_PROMPT_VERSION,
  };

  // 1st pass
  let result = await aiGenerateJSON(
    "evaluation",
    userId,
    systemPrompt,
    userPrompt,
    evaluationSchema,
    2,
    evalCallOptions,
  );

  // Unit 9: 校验每条 evidence.studentText 是否能在原对话中找到。
  // 找不到 → 1 次 wrap retry 加 hint；仍找不到 → 接受但 unverified=true。
  let mismatchedCount = countMismatchedEvidence(result.rubricBreakdown, joinedStudentText);
  if (mismatchedCount > 0) {
    const retryHint = buildEvidenceRetryHint(mismatchedCount);
    result = await aiGenerateJSON(
      "evaluation",
      userId,
      systemPrompt,
      userPrompt + retryHint,
      evaluationSchema,
      1,
      {
        ...evalCallOptions,
        metadata: { ...(options.metadata ?? {}), evidenceRetry: true },
      },
    );
    mismatchedCount = countMismatchedEvidence(result.rubricBreakdown, joinedStudentText);
    if (mismatchedCount > 0) {
      console.warn(
        `[evaluateSimulation] evidence 引用校验：${mismatchedCount} 条引用在 transcript 中找不到，标记 unverified=true`,
      );
    }
  }

  // 标准化: 确保分数不超上限, 补全缺失项
  const maxScore = data.rubric.reduce((sum, r) => sum + r.maxPoints, 0);
  const breakdown = data.rubric.map((r) => {
    const found = result.rubricBreakdown.find((b) => b.criterionId === r.id);
    const evidenceRaw = found?.evidence ?? [];
    // 限制每项 evidence ≤ 3 条 + 给每条打 unverified flag
    const evidence = evidenceRaw.slice(0, 3).map((ev) => ({
      studentText: ev.studentText,
      comment: ev.comment,
      unverified: ev.studentText !== "" && !joinedStudentText.includes(ev.studentText),
    }));
    return {
      criterionId: r.id,
      score: found ? Math.min(found.score, r.maxPoints) : 0,
      maxScore: r.maxPoints,
      comment: found?.comment || "暂无评语",
      evidence,
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
