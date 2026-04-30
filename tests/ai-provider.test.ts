import { afterEach, describe, expect, it } from "vitest";
import {
  getProviderConfig,
  getProviderForFeature,
  getProviderOptions,
} from "@/lib/services/ai.service";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("AI provider selection", () => {
  it("supports Xiaomi MiMo as an OpenAI-compatible provider", () => {
    process.env.MIMO_API_KEY = "test-key";
    process.env.MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
    process.env.MIMO_MODEL = "mimo-v2.5-pro";

    const provider = getProviderConfig("mimo");

    expect(provider).toMatchObject({
      name: "mimo",
      apiKey: "test-key",
      baseURL: "https://token-plan-cn.xiaomimimo.com/v1",
      defaultModel: "mimo-v2.5-pro",
    });
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

  it("falls back to the MiMo default model when stale Qwen feature models remain in env", () => {
    process.env.MIMO_API_KEY = "test-key";
    process.env.AI_PROVIDER = "mimo";
    process.env.AI_TASK_DRAFT_MODEL = "qwen-max";

    const { provider, model } = getProviderForFeature("taskDraft");

    expect(provider.name).toBe("mimo");
    expect(model).toBe("mimo-v2.5-pro");
  });

  it("sends MiMo thinking disabled without applying Qwen options", () => {
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
      openai: { thinking: { type: "disabled" } },
    });
    expect(getProviderOptions(qwen)).toEqual({
      openai: { enable_thinking: false },
    });
  });
});
