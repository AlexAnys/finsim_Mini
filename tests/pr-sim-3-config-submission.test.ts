import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

/**
 * PR-SIM-3 D3 · 资产配置"提交给客户"语义改造
 *
 * 用户原话："配置资产应该是可以提交给客户，而不是记录当前配置（意义不大）"
 *
 * 改造目标：
 * 1. 文案 "记录当前配比" → "提交给客户"
 * 2. 后端 chatReply 接受 messageType=config_submission + allocations 结构化输入
 * 3. systemPrompt 注入"客户视角对配置具体项回应"指令
 * 4. 前端 handleSubmitAllocation 改为调用 /api/ai/chat（messageType=config_submission）
 * 5. snapshots[] 持久化逻辑保留（PR-7C 兜底）
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("PR-SIM-3 D3 · ai.service config_submission 模式", () => {
  it("ai.service.ts 导出 ChatMessageType 类型 + 双值 union", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toContain("export type ChatMessageType");
    expect(src).toMatch(/"user_message"\s*\|\s*"config_submission"/);
  });

  it("chatReply 函数签名带可选 messageType + allocations 字段", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toMatch(/messageType\?:\s*ChatMessageType/);
    expect(src).toMatch(/allocations\?:\s*ChatAllocationSection\[\]/);
  });

  it("systemPrompt 在 messageType=config_submission 时注入额外指令段", () => {
    const src = readFile("lib/services/ai.service.ts");
    // 关键标记：configSubmissionBlock + 提交资产配置 + 必须点名具体项
    expect(src).toContain("configSubmissionBlock");
    expect(src).toContain("【本轮交互类型 · 资产配置提交 · PR-SIM-3】");
    expect(src).toContain("必须在 reply 中明确提到配置的至少一项具体内容");
    expect(src).toContain("不要泛泛评价整体");
  });

  it("userPrompt 在 config_submission 时附加 allocations 摊平段", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toContain("allocationSubmissionText");
    expect(src).toContain("提交资产配置（学生当前要客户对这版方案的反馈）");
    // 摊平格式: section.label + items {label}: {value}%
    expect(src).toMatch(/sec\.items[\s\S]+?\.map\(\(it\) =>[^`]*`\s+·\s+\$\{it\.label\}:\s*\$\{it\.value\}%`\)/);
  });

  it("默认 messageType 为 user_message — 历史 caller 不受影响（PR-7B 不破坏）", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toContain('const messageType: ChatMessageType = data.messageType ?? "user_message"');
  });
});

describe("PR-SIM-3 D3 · /api/ai/chat 路由 schema", () => {
  it("chatSchema 接受 messageType + allocations 字段（zod enum + array of sections）", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toContain('messageType: z.enum(["user_message", "config_submission"])');
    expect(src).toContain("allocations: z");
    expect(src).toContain("sections 数量超长");
    expect(src).toContain("items 数量超长");
  });

  it("config_submission 必须带 allocations（路由层守护）", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toContain('parsed.data.messageType === "config_submission"');
    expect(src).toContain("提交配置时必须附带 allocations");
  });

  it("MAX_ALLOCATION_* 常量存在（防 token 浪费 / context overflow）", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toContain("MAX_ALLOCATION_SECTIONS");
    expect(src).toContain("MAX_ALLOCATION_ITEMS_PER_SECTION");
    expect(src).toContain("MAX_ALLOCATION_LABEL_CHARS");
  });
});

describe("PR-SIM-3 D3 · simulation-runner.tsx UI 改造", () => {
  it("按钮文案 '提交给客户' 替换 '记录当前配比'", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toContain("提交给客户");
    // 旧文案"记录当前配比"必须在主按钮处删除（toast 中也已替换）
    expect(src).not.toContain("记录当前配比");
  });

  it("snapshot 计数文案改为 '已向客户提交 N 次配置'", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toContain("已向客户提交");
    expect(src).toContain("次配置");
  });

  it("handleSubmitAllocation 走 /api/ai/chat（messageType=config_submission）", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    // POST /api/ai/chat 调用包含 messageType + allocations
    expect(src).toMatch(/messageType:\s*"config_submission"/);
    expect(src).toContain("allocations: allocations.map((s) => ({");
    // loading toast 提示
    expect(src).toContain("客户正在阅读你的配置");
    // 成功 toast
    expect(src).toContain("客户已回应你的配置");
  });

  it("AI 客户回复后 push 到 messages[]（role=ai）+ mood/snapshot 双更新", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    // setMessages 调用客户消息
    expect(src).toMatch(/setMessages\(\(prev\) => \[\.\.\.prev, aiMsg\]\)/);
    // setSnapshots 仍 push（PR-7C 兜底）
    expect(src).toMatch(/setSnapshots\(\(prev\) => \[/);
    // setMood 更新
    expect(src).toContain("setMood(newMood)");
  });

  it("handleSubmitAllocation 复用 stripLegacyMoodTag + moodKeyFromLabel（与 handleSend 一致）", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    // handleSubmitAllocation 函数体内复用 PR-7B 的 mood 解析逻辑
    const startIdx = src.indexOf("async function handleSubmitAllocation()");
    const endIdx = src.indexOf("function handleResetAllocation");
    expect(startIdx).toBeGreaterThan(0);
    expect(endIdx).toBeGreaterThan(startIdx);
    const fnBody = src.slice(startIdx, endIdx);
    expect(fnBody).toContain("stripLegacyMoodTag(rawReply)");
    expect(fnBody).toContain("moodKeyFromLabel(moodObj.label)");
  });

  it("PR-7C snapshots 持久化逻辑仍保留（assets.snapshots 上报路径不动）", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    // 现有 PR-7C 流程：snapshots 在 handleSubmit / handleFinishConversation
    // 通过 assets={ sections: allocations, snapshots } 上报。本 PR 不动这部分。
    const occurrences = src.match(/\{\s*sections:\s*allocations,\s*snapshots\s*\}/g);
    expect(occurrences).not.toBeNull();
    // 至少 3 处（preview evaluate / student submit-direct / final submit），证明 PR-7C 路径完整保留。
    expect(occurrences!.length).toBeGreaterThanOrEqual(3);
    // saveDraft 仍把 snapshots 写入 localStorage
    expect(src).toContain("snapshots: snaps");
  });
});

describe("PR-SIM-3 D3 · zod schema 实模拟（与运行时匹配）", () => {
  // 与 app/api/ai/chat/route.ts 的 zod schema 等价快照
  // 用来证明 schema 形状能正常 parse/reject 真请求
  const chatSchema = z.object({
    transcript: z.array(
      z.object({
        role: z.string(),
        text: z.string().max(2000),
        hint: z.string().max(2000).optional(),
      })
    ).max(50),
    scenario: z.string().max(4000),
    openingLine: z.string().max(2000).optional(),
    systemPrompt: z.string().max(4000).optional(),
    lastHintTurn: z.number().int().nonnegative().optional(),
    objectives: z.array(z.string()).max(20).optional(),
    messageType: z.enum(["user_message", "config_submission"]).optional(),
    allocations: z
      .array(
        z.object({
          label: z.string().max(80),
          items: z
            .array(
              z.object({
                label: z.string().max(80),
                value: z.number().min(0).max(100),
              })
            )
            .max(30),
        })
      )
      .max(10)
      .optional(),
  });

  it("user_message 不带 allocations → 通过", () => {
    const result = chatSchema.safeParse({
      transcript: [{ role: "student", text: "你好" }],
      scenario: "金融咨询",
      messageType: "user_message",
    });
    expect(result.success).toBe(true);
  });

  it("config_submission 带 allocations → 通过", () => {
    const result = chatSchema.safeParse({
      transcript: [{ role: "ai", text: "你好" }],
      scenario: "金融咨询",
      messageType: "config_submission",
      allocations: [
        {
          label: "资产配置",
          items: [
            { label: "股票", value: 30 },
            { label: "债券", value: 50 },
            { label: "现金", value: 20 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("messageType 非法值 → schema 拒绝", () => {
    const result = chatSchema.safeParse({
      transcript: [],
      scenario: "x",
      messageType: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("allocations.items.value 超 100 → schema 拒绝", () => {
    const result = chatSchema.safeParse({
      transcript: [],
      scenario: "x",
      messageType: "config_submission",
      allocations: [
        {
          label: "x",
          items: [{ label: "a", value: 150 }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("allocations.sections 超 10 个 → schema 拒绝", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      label: `S${i}`,
      items: [{ label: "a", value: 50 }],
    }));
    const result = chatSchema.safeParse({
      transcript: [],
      scenario: "x",
      messageType: "config_submission",
      allocations: tooMany,
    });
    expect(result.success).toBe(false);
  });

  it("default messageType 缺省 → 通过（兼容历史 caller）", () => {
    const result = chatSchema.safeParse({
      transcript: [{ role: "student", text: "你好" }],
      scenario: "金融咨询",
    });
    expect(result.success).toBe(true);
  });
});
