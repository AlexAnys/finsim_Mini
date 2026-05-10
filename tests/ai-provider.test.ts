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

  it("does not silently fallback when a teacher explicitly selects a provider", () => {
    delete process.env.MIMO_API_KEY;
    process.env.QWEN_API_KEY = "qwen-key";
    process.env.AI_FALLBACK_PROVIDER = "qwen";

    const { provider, model } = getProviderForFeature("simulation", {
      provider: "mimo",
      model: "mimo-v2.5-pro",
    });

    expect(provider.name).toBe("mimo");
    expect(provider.apiKey).toBe("");
    expect(model).toBe("mimo-v2.5-pro");
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

  it("normalizes non-MiMo runtime provider overrides back to MiMo", () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.QWEN_API_KEY = "qwen-key";

    const { provider, model } = getProviderForFeature("weeklyInsight", {
      provider: "qwen",
      model: "qwen-max",
    });

    expect(provider.name).toBe("mimo");
    expect(model).toBe("mimo-v2.5-pro");
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
