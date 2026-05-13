import { afterEach, describe, expect, it } from "vitest";
import {
  getProviderConfig,
  getProviderForFeature,
  getProviderOptions,
  resolveMimoBaseUrl,
} from "@/lib/services/ai.service";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("AI provider selection", () => {
  it("supports Xiaomi MiMo as an OpenAI-compatible provider", () => {
    process.env.MIMO_API_KEY = "test-key";
    process.env.MIMO_BASE_URL = "https://api.xiaomimimo.com/v1";
    process.env.MIMO_MODEL = "mimo-v2.5-pro";

    const provider = getProviderConfig("mimo");

    expect(provider).toMatchObject({
      name: "mimo",
      apiKey: "test-key",
      baseURL: "https://api.xiaomimimo.com/v1",
      defaultModel: "mimo-v2.5-pro",
    });
  });

  it("Fix 4 · 老师选 provider 但缺 key → 走 AI_FALLBACK_PROVIDER 真生效（不再 silent 返回 keyless）", () => {
    // 之前: 选 mimo 但缺 MIMO_API_KEY → silent return keyless-mimo（让 createOpenAI 拿 apiKey:"" 后
    //       在网络层 401，老师看到的是含糊错误）。
    // Fix 4: 缺 key 时显式走 fallback 链；fallback 也缺 → throw AI_PROVIDER_NOT_CONFIGURED，
    //        handleServiceError 映射成中文 "AI 服务未配置"。
    delete process.env.MIMO_API_KEY;
    process.env.QWEN_API_KEY = "qwen-key";
    process.env.AI_FALLBACK_PROVIDER = "qwen";

    const { provider, model } = getProviderForFeature("simulation", {
      provider: "mimo",
      model: "mimo-v2.5-pro",
    });

    // 应该走 fallback 到 qwen（而不是 silent 给 keyless mimo）
    expect(provider.name).toBe("qwen");
    expect(provider.apiKey).toBe("qwen-key");
    // requestedModel="mimo-v2.5-pro" 与 qwen 不兼容 → 落回 qwen defaultModel
    expect(model).toBe("qwen3-max");
  });

  it("defaults feature calls to MiMo when no provider override is set", () => {
    process.env.MIMO_API_KEY = "test-key";
    delete process.env.AI_PROVIDER;
    delete process.env.AI_TASK_DRAFT_PROVIDER;
    delete process.env.AI_TASK_DRAFT_MODEL;

    const { provider, model } = getProviderForFeature("taskDraft");

    expect(provider.name).toBe("mimo");
    expect(model).toBe("mimo-v2.5-pro");
  });

  it("routes MiMo token-plan keys to the token-plan OpenAI-compatible base", () => {
    delete process.env.MIMO_BASE_URL;

    expect(resolveMimoBaseUrl("tp-test-key")).toBe("https://token-plan-cn.xiaomimimo.com/v1");
    expect(resolveMimoBaseUrl("sk-test-key")).toBe("https://api.xiaomimimo.com/v1");
  });

  it("falls back to the MiMo default model when stale Qwen feature models remain in env", () => {
    process.env.MIMO_API_KEY = "test-key";
    process.env.AI_PROVIDER = "mimo";
    process.env.AI_TASK_DRAFT_MODEL = "qwen-max";

    const { provider, model } = getProviderForFeature("taskDraft");

    expect(provider.name).toBe("mimo");
    expect(model).toBe("mimo-v2.5-pro");
  });

  it("uses MiMo as the implicit fallback provider", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER;
    delete process.env.QWEN_API_KEY;
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.AI_TASK_DRAFT_PROVIDER = "qwen";

    const { provider, model } = getProviderForFeature("taskDraft");

    expect(provider.name).toBe("mimo");
    expect(model).toBe("mimo-v2.5-pro");
  });

  it("Fix 4 · 老师选 qwen + qwen key 存在 → 真用 qwen，不再被强制改写到 mimo", () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.QWEN_API_KEY = "qwen-key";

    const { provider, model } = getProviderForFeature("weeklyInsight", {
      provider: "qwen",
      model: "qwen-max",
    });

    expect(provider.name).toBe("qwen");
    expect(model).toBe("qwen-max");
    expect(provider.apiKey).toBe("qwen-key");
  });

  it("Fix 4 · 老师选 deepseek/gemini/openai 也一样真生效（缺 key 时走 fallback 链）", () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.OPENAI_API_KEY = "openai-key";

    expect(
      getProviderForFeature("evaluation", { provider: "deepseek" }).provider.name,
    ).toBe("deepseek");
    expect(
      getProviderForFeature("evaluation", { provider: "gemini" }).provider.name,
    ).toBe("gemini");
    expect(
      getProviderForFeature("evaluation", { provider: "openai" }).provider.name,
    ).toBe("openai");
  });

  it("Fix 4 · 选了 provider 但 .env 缺 key → throw AI_PROVIDER_NOT_CONFIGURED 而不是默默改写到 mimo", () => {
    // 注意：旧版本是 `requestedProviderName === "mimo" ? ... : "mimo"`（强制改写），
    // 切到 qwen 又没 qwen key 时不报错；现在让真实 provider 生效，缺 key 必须显式失败。
    delete process.env.QWEN_API_KEY;
    delete process.env.MIMO_API_KEY;
    delete process.env.AI_FALLBACK_PROVIDER;
    expect(() =>
      getProviderForFeature("quizDraft", { provider: "qwen" }),
    ).toThrow(/AI_PROVIDER_NOT_CONFIGURED/);
  });

  it("Fix 4 · 选了 provider 但缺 key + 配 AI_FALLBACK_PROVIDER=mimo + MIMO_API_KEY 存在 → fallback 到 mimo（不报错，保留 fallback 链）", () => {
    delete process.env.QWEN_API_KEY;
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.AI_FALLBACK_PROVIDER = "mimo";
    const { provider } = getProviderForFeature("quizDraft", { provider: "qwen" });
    expect(provider.name).toBe("mimo");
  });

  it("sends MiMo reasoningEffort=none by default + Qwen enable_thinking=false", () => {
    // 历史曾用 `thinking: { type: 'disabled' }`，但 @ai-sdk/openai 白名单不接受
    // 该字段（SDK 静默吞掉），导致 MiMo 默认开启 reasoning。改用 SDK 白名单内
    // 的标准 reasoningEffort（序列化为 reasoning_effort 下发）。
    const mimo = {
      name: "mimo" as const,
      apiKey: "test-key",
      baseURL: "https://api.xiaomimimo.com/v1",
      defaultModel: "mimo-v2.5-pro",
    };
    const qwen = {
      name: "qwen" as const,
      apiKey: "test-key",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      defaultModel: "qwen3-max",
    };

    expect(getProviderOptions(mimo)).toEqual({
      openai: { reasoningEffort: "none" },
    });
    expect(getProviderOptions(qwen)).toEqual({
      openai: { enable_thinking: false },
    });
  });
});
