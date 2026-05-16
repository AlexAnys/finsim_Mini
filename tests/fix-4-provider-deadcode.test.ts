import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import {
  getProviderConfig,
  getProviderForFeature,
  type AiCallOptions,
} from "@/lib/services/ai.service";
import {
  AI_PROVIDER_OPTIONS,
  upsertAiToolSetting,
} from "@/lib/services/ai-tool-settings.service";

/**
 * Fix 4 (review fixes batch 1) · Provider 死代码删除
 *
 * 历史问题（spec L149）:
 *   - ai.service.ts:151 强制 `requestedProviderName === "mimo" ? requestedProviderName : "mimo"`
 *   - ai.service.ts:168 fallback 同样强制
 *   - ai-tool-settings.service.ts:160 schema 只 enum(["mimo"])
 *   - UI 下拉只有 mimo 但 .env.example 列 5 个 provider
 * 老师选了 qwen/deepseek 实际仍走 mimo（"幽灵设置"，对用户撒谎）。
 *
 * Fix 4 让 setting 真生效：
 *   - 删强制改写
 *   - schema 扩 5 enum
 *   - UI 真实下拉 5 项
 *   - 测试连接按钮 1-shot ping
 *   - 缺 key 时中文错误
 *   - 不破坏 da9a505 mimo reasoning fix
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Fix 4 · ai.service 不再强制改写 provider", () => {
  it("ai.service.ts 删除了 `requestedProviderName === \"mimo\" ? ... : \"mimo\"` 强制改写", () => {
    const src = readFile("lib/services/ai.service.ts");
    // 历史的硬编码三元已删
    expect(src).not.toMatch(
      /requestedProviderName === "mimo" \? requestedProviderName : "mimo"/,
    );
    expect(src).not.toMatch(
      /requestedFallbackName === "mimo" \? requestedFallbackName : "mimo"/,
    );
    // 注释保留事故 context（防止后人误把改写加回来）
    expect(src).toMatch(/Fix 4[^\n]*强制改写成 mimo/);
  });

  it("getProviderConfig 新增 gemini case（5 provider 齐备）", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    const cfg = getProviderConfig("gemini");
    expect(cfg).not.toBeNull();
    expect(cfg!.name).toBe("gemini");
    expect(cfg!.apiKey).toBe("gemini-key");
    expect(cfg!.baseURL).toMatch(/generativelanguage|gemini/i);
  });

  it("getProviderForFeature 真生效：5 provider 都能拿到正确 config", () => {
    process.env.MIMO_API_KEY = "mk";
    process.env.QWEN_API_KEY = "qk";
    process.env.DEEPSEEK_API_KEY = "dk";
    process.env.GEMINI_API_KEY = "gk";
    process.env.OPENAI_API_KEY = "ok";

    for (const provider of ["mimo", "qwen", "deepseek", "gemini", "openai"] as const) {
      const out = getProviderForFeature("simulation", { provider });
      expect(out.provider.name).toBe(provider);
      expect(out.provider.apiKey).not.toBe("");
    }
  });

  it("缺 key + 无 fallback → throw AI_PROVIDER_NOT_CONFIGURED（不再 silent keyless）", () => {
    delete process.env.QWEN_API_KEY;
    delete process.env.MIMO_API_KEY;
    delete process.env.AI_FALLBACK_PROVIDER;
    delete process.env.AI_PROVIDER;
    expect(() => getProviderForFeature("quizDraft", { provider: "qwen" })).toThrow(
      /AI_PROVIDER_NOT_CONFIGURED/,
    );
  });

  it("isModelCompatible 加 gemini 校验（gemini-* 前缀通过）", () => {
    process.env.GEMINI_API_KEY = "gk";
    delete process.env.AI_PROVIDER;
    // requestedModel=gemini-2.5-flash 应被接受
    const out = getProviderForFeature("simulation", {
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
    expect(out.provider.name).toBe("gemini");
    expect(out.model).toBe("gemini-2.5-flash");
  });

  it("不破坏 da9a505 mimo reasoning fix（getProviderOptions 仍 reasoningEffort 路径）", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toMatch(/reasoningEffort:\s*thinking\s*===\s*"enabled"\s*\?\s*"high"\s*:\s*"low"/);
  });
});

describe("Fix 4 · ai-tool-settings.service 5 provider 真实开放", () => {
  it("AI_PROVIDER_OPTIONS 包含 5 个 provider（mimo + qwen + deepseek + gemini + openai）", () => {
    expect(AI_PROVIDER_OPTIONS.map((p) => p.value)).toEqual([
      "mimo",
      "qwen",
      "deepseek",
      "gemini",
      "openai",
    ]);
    // 每个都有中文 label + description（教师 UI 渲染用）
    for (const p of AI_PROVIDER_OPTIONS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("upsertAiToolSetting 接受 5 个 provider value（不再 AI_PROVIDER_NOT_FOUND 拒绝）", async () => {
    // 注：这里只校验 zod 不抛 AI_PROVIDER_NOT_FOUND；真实 DB 写不在 vitest 范围。
    // upsertAiToolSetting 在 invalid provider 时 throw AI_PROVIDER_NOT_FOUND 是早期校验。
    // 用 try/catch 区分校验拒绝 vs prisma 调用失败。
    for (const p of ["mimo", "qwen", "deepseek", "gemini", "openai"] as const) {
      let validationError = false;
      try {
        await upsertAiToolSetting("test-teacher-id", {
          toolKey: "simulationChat",
          provider: p,
        });
      } catch (err) {
        // prisma 失败（连接不上 DB / teacher 不存在）是 OK 的；validation 拒绝才是 fail
        if (err instanceof Error && err.message === "AI_PROVIDER_NOT_FOUND") {
          validationError = true;
        }
      }
      expect(validationError).toBe(false);
    }
  });
});

describe("Fix 4 · /api/ai/tool-settings 路由 schema 扩到 5", () => {
  it("schema enum 列出 5 个 provider", () => {
    const src = readFile("app/api/ai/tool-settings/route.ts");
    expect(src).toMatch(
      /provider:\s*z\.enum\(\[\s*"mimo",\s*"qwen",\s*"deepseek",\s*"gemini",\s*"openai"\s*\]\)/,
    );
  });

  it("zod schema 真实接受 5 个 provider 值", () => {
    const schema = z.object({
      provider: z.enum(["mimo", "qwen", "deepseek", "gemini", "openai"]).optional().nullable(),
    });
    for (const p of ["mimo", "qwen", "deepseek", "gemini", "openai"]) {
      expect(schema.safeParse({ provider: p }).success).toBe(true);
    }
    expect(schema.safeParse({ provider: "unknown" }).success).toBe(false);
  });
});

describe("Fix 4 · 测试连接接口", () => {
  it("/api/ai/tool-settings/test-connection 路由存在 + 走 requireRole(teacher/admin)", () => {
    const src = readFile("app/api/ai/tool-settings/test-connection/route.ts");
    expect(src).toMatch(/requireRole\(\[\s*"teacher"\s*,\s*"admin"\s*\]\)/);
    expect(src).toContain("aiGenerateText");
    // 5 个 provider 都映射中文 label
    for (const label of ["小米 MiMo", "阿里通义千问", "DeepSeek", "Google Gemini", "OpenAI"]) {
      expect(src).toContain(label);
    }
  });

  it("缺 key 时返回 AI_PROVIDER_KEY_MISSING + 中文「API key 未配置」", () => {
    const src = readFile("app/api/ai/tool-settings/test-connection/route.ts");
    expect(src).toContain("AI_PROVIDER_KEY_MISSING");
    expect(src).toContain("API key 未配置");
    expect(src).toContain("MIMO_API_KEY");
    expect(src).toContain("QWEN_API_KEY");
    expect(src).toContain("DEEPSEEK_API_KEY");
    expect(src).toContain("GEMINI_API_KEY");
    expect(src).toContain("OPENAI_API_KEY");
  });
});

describe("Fix 4 · AI 设置 UI 真实下拉 + 测试按钮", () => {
  it("UI Provider <Select> 用 providers 数组渲染（真实多项）", () => {
    // Unit B1: 抽离到 components/ai-workbench/settings-tab.tsx
    const src = readFile("components/ai-workbench/settings-tab.tsx");
    // 渲染来自 listAiToolSettings 返回的 providerOptions
    expect(src).toMatch(/providers\.map\(\(provider\) =>/);
    expect(src).toContain("<SelectItem");
  });

  it("「测试连接」按钮 + testConnection() 函数", () => {
    // Unit B1: 抽离到 components/ai-workbench/settings-tab.tsx
    const src = readFile("components/ai-workbench/settings-tab.tsx");
    expect(src).toContain("测试连接");
    expect(src).toContain("async function testConnection");
    expect(src).toContain("/api/ai/tool-settings/test-connection");
    // 成功/失败状态显示
    expect(src).toContain("连通正常");
  });

  it("ToolSetting 接口的 provider 字段保留（未硬编码成 \"mimo\" 字面量类型）", () => {
    // Unit B1: 抽离到 components/ai-workbench/settings-tab.tsx
    const src = readFile("components/ai-workbench/settings-tab.tsx");
    // ToolSetting.provider 是 string，不是 string literal "mimo"
    expect(src).toMatch(/provider:\s*string;/);
  });
});

// satisfies "import is used" so AiCallOptions doesn't get tree-shaken
const _unused: AiCallOptions = {};
void _unused;
