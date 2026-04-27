import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * PR-FIX-4 D1 · 任务向导旧 5 档 [MOOD:] prompt 清理。
 *
 * 验证 spec L52 — task wizard（PR-COURSE-1+2 后由
 * `components/teacher-course-edit/task-wizard-modal.tsx` 持有）与
 * `app/teacher/tasks/[id]/page.tsx`（编辑页）的 systemPrompt 模板中
 * 已删除旧 5 档 `[MOOD: HAPPY|NEUTRAL|...]` 指令（PR-7B 已切到 8 档
 * JSON 协议，运行时由 ai.service.chatReply 注入）。
 *
 * 历史：PR-COURSE-1+2 删除了 /teacher/tasks/new 路由，wizard 整合到
 * 课程编辑器 modal。原文件 `app/teacher/tasks/new/page.tsx` 的资产搬到
 * `components/teacher-course-edit/task-wizard-modal.tsx`，本测试守护
 * 同等内容（[MOOD:] 不复发 + systemPrompt 仍生成）。
 *
 * 静态文件扫描即可证明 D1 已落（不需要真 AI E2E）。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("PR-FIX-4 D1 · 旧 5 档 [MOOD:] 指令清理", () => {
  it("components/teacher-course-edit/task-wizard-modal.tsx 不再包含 [MOOD: HAPPY|NEUTRAL|... 指令模板", () => {
    const src = readFile(
      "components/teacher-course-edit/task-wizard-modal.tsx",
    );
    // 模板字面量字符串中不应再出现这种 5 枚举的 [MOOD:] 列表
    expect(src).not.toMatch(
      /\[MOOD:\s*HAPPY\s*\|\s*NEUTRAL\s*\|\s*CONFUSED\s*\|\s*SKEPTICAL\s*\|\s*ANGRY\]/,
    );
    // 不应再出现"在每条回复末尾附加：[MOOD:" 的旧指令
    expect(src).not.toMatch(/在每条回复末尾附加：\[MOOD:/);
  });

  it("app/teacher/tasks/[id]/page.tsx（编辑页）也已清理", () => {
    const src = readFile("app/teacher/tasks/[id]/page.tsx");
    expect(src).not.toMatch(
      /\[MOOD:\s*HAPPY\s*\|\s*NEUTRAL\s*\|\s*CONFUSED\s*\|\s*SKEPTICAL\s*\|\s*ANGRY\]/,
    );
    expect(src).not.toMatch(/在每条回复末尾附加：\[MOOD:/);
  });

  it("两个教师向导持有点 systemPrompt 仍生成（仅承载人设/对话风格/禁止行为）", () => {
    const wizardSrc = readFile(
      "components/teacher-course-edit/task-wizard-modal.tsx",
    );
    const editSrc = readFile("app/teacher/tasks/[id]/page.tsx");
    // 两个文件都仍有 systemPrompt 生成 + 引用 promptParts.join + 包含 {scenario}
    for (const src of [wizardSrc, editSrc]) {
      expect(src).toContain("const systemPrompt = promptParts.length > 0");
      expect(src).toContain("{scenario}");
      // 仍包含基础人设引言
      expect(src).toContain("你是一个金融理财场景中的模拟客户");
    }
  });

  it("ai.service.ts 的 chatReply 输出格式仍是 8 档 JSON 协议（PR-7B）", () => {
    const src = readFile("lib/services/ai.service.ts");
    // 8 档 JSON 协议关键标记仍在
    expect(src).toContain("【输出格式 · 严格 JSON · PR-7B】");
    expect(src).toContain("mood_label");
    // 8 个中文标签仍在
    for (const label of [
      "平静",
      "放松",
      "兴奋",
      "犹豫",
      "怀疑",
      "略焦虑",
      "焦虑",
      "失望",
    ]) {
      expect(src).toContain(label);
    }
  });
});

describe("PR-FIX-4 D1 · stripLegacyMoodBlock service-layer strip（兼容老任务模板）", () => {
  it("整段【情绪标签】+ 5 档 [MOOD:] 列表 → 全清", async () => {
    const { stripLegacyMoodBlock } = await import("@/lib/services/task.service");
    const old = "你是模拟客户。\n\n{scenario}\n\n【核心人设】温和\n\n【情绪标签】\n在每条回复末尾附加：[MOOD: HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY]\n- HAPPY: 觉得有道理\n- NEUTRAL: 正常交流\n- CONFUSED: 太多术语\n- SKEPTICAL: 不符合实际\n- ANGRY: 反复推销不适合的产品";
    const cleaned = stripLegacyMoodBlock(old);
    expect(cleaned).not.toContain("【情绪标签】");
    expect(cleaned).not.toContain("[MOOD:");
    expect(cleaned).not.toContain("ANGRY");
    expect(cleaned).toContain("【核心人设】温和");
    expect(cleaned).toContain("{scenario}");
  });

  it("仅含 [MOOD: HAPPY|NEUTRAL|...] 列表残片（无【情绪标签】块）→ 兜底清", async () => {
    const { stripLegacyMoodBlock } = await import("@/lib/services/task.service");
    const old = "客户人设。 [MOOD: HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY] 结尾正常。";
    const cleaned = stripLegacyMoodBlock(old);
    expect(cleaned).not.toContain("[MOOD:");
    expect(cleaned).toContain("客户人设");
    expect(cleaned).toContain("结尾正常");
  });

  it("已清干净的 prompt（PR-FIX-4 之后新建）byte-EQ 透传", async () => {
    const { stripLegacyMoodBlock } = await import("@/lib/services/task.service");
    const clean = "你是模拟客户。\n\n{scenario}\n\n【核心人设】温和";
    const result = stripLegacyMoodBlock(clean);
    expect(result).toBe(clean);
  });

  it("空 / undefined / null → 透传不抛", async () => {
    const { stripLegacyMoodBlock } = await import("@/lib/services/task.service");
    expect(stripLegacyMoodBlock(undefined)).toBeUndefined();
    expect(stripLegacyMoodBlock(null)).toBeUndefined();
    expect(stripLegacyMoodBlock("")).toBeUndefined();
  });

  it("strip 后只剩空白 → 返回 undefined（教师 systemPrompt 当无）", async () => {
    const { stripLegacyMoodBlock } = await import("@/lib/services/task.service");
    const onlyMood = "\n\n【情绪标签】\n在每条回复末尾附加：[MOOD: HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY]\n- HAPPY: 好\n- NEUTRAL: 中\n- CONFUSED: 困\n- SKEPTICAL: 疑\n- ANGRY: 怒";
    const cleaned = stripLegacyMoodBlock(onlyMood);
    expect(cleaned).toBeUndefined();
  });
});
