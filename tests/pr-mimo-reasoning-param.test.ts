import { describe, it, expect } from "vitest";
import { getProviderOptions, getProviderConfig } from "@/lib/services/ai.service";

/**
 * Bug fix: Vercel AI SDK @ai-sdk/openai 的 providerOptions.openai 是白名单
 * schema，历史 `thinking: { type: ... }` 字段不在白名单 → SDK 静默吞掉。
 * 结果 MiMo v2.5-pro 默认开启 reasoning，所有 sim chat 一直在 reasoning 模式跑。
 *
 * 实测（直接 curl）：
 *   - 不传任何 reasoning 控制 → reasoning_content 156 bytes / 2.18s（基线，跟 SDK 路径等价）
 *   - reasoning_effort: "none" → reasoning_content 无 / 0.24s（9× 提速）
 *
 * 修复：改用 OpenAI 标准 reasoningEffort（SDK 白名单内字段，序列化成
 * reasoning_effort 下发到 MiMo）。
 */

const ORIGINAL_ENV = { ...process.env };

describe("MiMo reasoning param fix · getProviderOptions", () => {
  it("thinking='disabled' → openai.reasoningEffort='none'（真正关掉 MiMo reasoning）", () => {
    process.env.MIMO_API_KEY = "test-key";
    const provider = getProviderConfig("mimo")!;
    const opts = getProviderOptions(provider, { thinking: "disabled" }, "simulation");
    expect(opts).toEqual({ openai: { reasoningEffort: "none" } });
  });

  it("thinking='enabled' → openai.reasoningEffort='high'（启用 reasoning）", () => {
    process.env.MIMO_API_KEY = "test-key";
    const provider = getProviderConfig("mimo")!;
    // evaluation 不在 force-disable 集合 → 用 setting 决定
    const opts = getProviderOptions(provider, { thinking: "enabled" }, "evaluation");
    expect(opts).toEqual({ openai: { reasoningEffort: "high" } });
  });

  it("force-disable feature 始终 reasoningEffort='none' 即便 setting 启了 thinking", () => {
    process.env.MIMO_API_KEY = "test-key";
    const provider = getProviderConfig("mimo")!;
    // simulation 在 force-disable 集合
    const opts = getProviderOptions(provider, { thinking: "enabled" }, "simulation");
    expect(opts).toEqual({ openai: { reasoningEffort: "none" } });
  });

  it("没有 setting 默认 disabled → reasoningEffort='none'", () => {
    process.env.MIMO_API_KEY = "test-key";
    const provider = getProviderConfig("mimo")!;
    const opts = getProviderOptions(provider, null, "evaluation");
    expect(opts).toEqual({ openai: { reasoningEffort: "none" } });
  });

  it("不再发送旧的 thinking 字段（防止后人重新引入）", () => {
    process.env.MIMO_API_KEY = "test-key";
    const provider = getProviderConfig("mimo")!;
    const opts = getProviderOptions(provider, { thinking: "enabled" }, "evaluation") as {
      openai: Record<string, unknown>;
    };
    expect(opts.openai).not.toHaveProperty("thinking");
  });

  process.env = { ...ORIGINAL_ENV };
});
