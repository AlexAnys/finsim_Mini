import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * PR-1 Simulation hardening — 三处加固：
 * 1. /api/ai/chat: role 限 enum(["student","ai"]) + 严格交替校验
 * 2. /api/ai/evaluate: requireRole(["teacher","admin"])
 * 3. ai.service.ts: JSON_FORCE_DISABLE_THINKING 加上主路径
 *
 * 上下文：staging 实测 + codex 评审发现 transcript role 是 z.string()，
 * evaluate 仅 requireAuth，主对话/评分 feature 不在 thinking-disable 集合里 ——
 * 三个独立缺陷指向同一类问题（信任客户端 / 默认开放 / 隐藏失败）。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("PR-1 · /api/ai/chat 角色信任收紧", () => {
  it("transcript role 限定 z.enum([\"student\",\"ai\"])，不再接受任意字符串", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toMatch(/role:\s*z\.enum\(\[\s*"student"\s*,\s*"ai"\s*\]\)/);
  });

  // 注：不做结构层 alternation 校验 —— openingLine 必然导致 transcript[0] 是 ai；
  // 失败重试合法形成 [ai, student, student]。真正的 transcript 信任要靠服务端
  // turn log 做内容比对，下一迭代专项处理。这里只确认代码里有"为什么不校验"
  // 的注释，避免后人重新引入 alternation 校验把 simulation 弄坏。
  it("有显式注释说明为什么不在此处做结构校验（防止后人再加 alternation 拦截）", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toMatch(/openingLine[\s\S]*?messages\[0\]/);
    expect(src).toMatch(/可信\s*turn\s*log/);
  });
});

describe("PR-1 · /api/ai/evaluate 限教师/管理员", () => {
  it("从 requireAuth 改成 requireRole([\"teacher\",\"admin\"])", () => {
    const src = readFile("app/api/ai/evaluate/route.ts");
    expect(src).toMatch(/import\s+\{\s*requireRole\s*\}\s+from\s+"@\/lib\/auth\/guards"/);
    expect(src).toMatch(/requireRole\(\[\s*"teacher"\s*,\s*"admin"\s*\]\)/);
    // 不应再保留 requireAuth 的导入或调用
    expect(src).not.toMatch(/import\s+\{\s*requireAuth\s*\}/);
    expect(src).not.toMatch(/await\s+requireAuth\(\)/);
  });

  it("注释解释为什么不开放给学生（防 rubric 篡改 + AI 配额滥用）", () => {
    const src = readFile("app/api/ai/evaluate/route.ts");
    expect(src).toMatch(/学生[\s\S]*?\/api\/submissions/);
    expect(src).toMatch(/(rubric|scenario|配额|烧)/);
  });
});

describe("PR-1 · ai.service.ts thinking 强制关闭集合", () => {
  it("sync user-facing 路径（simulation / studyBuddyReply）在集合内 — 延迟敏感强制 OFF", () => {
    const src = readFile("lib/services/ai.service.ts");
    const setMatch = src.match(/JSON_FORCE_DISABLE_THINKING[\s\S]*?\]\)/);
    expect(setMatch, "JSON_FORCE_DISABLE_THINKING 集合未找到").toBeTruthy();
    const block = setMatch![0];
    expect(block).toContain('"simulation"');
    expect(block).toContain('"studyBuddyReply"');
  });

  it("async batch 路径（evaluation / quizGrade / subjectiveGrade / studyBuddySummary）不在集合内 — 让 thinking 提升质量", () => {
    const src = readFile("lib/services/ai.service.ts");
    const setMatch = src.match(/JSON_FORCE_DISABLE_THINKING[\s\S]*?\]\)/);
    const block = setMatch![0];
    expect(block).not.toContain('"evaluation"');
    expect(block).not.toContain('"quizGrade"');
    expect(block).not.toContain('"subjectiveGrade"');
    expect(block).not.toContain('"studyBuddySummary"');
  });

  it("注释明确 sync OFF / async ON 决策原则，防止后人盲加 feature", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toMatch(/sync user-facing[\s\S]*?async batch/);
  });

  it("getProviderOptions 仍然按 feature 决定 thinking（保留原有逻辑）", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toMatch(
      /JSON_FORCE_DISABLE_THINKING\.has\(feature\)\s*\?\s*"disabled"\s*:\s*baseThinking/,
    );
  });
});

describe("PR-1 · 不破坏既有契约", () => {
  it("simulation-runner.tsx 的 chat fetch payload 仍然只发 student/ai 角色", () => {
    // role 在客户端只用 "student" 和 "ai"，与新 enum 一致
    const src = readFile("components/simulation/simulation-runner.tsx");
    // 不允许出现客户端构造 role: "customer" / role: "user" 之类
    expect(src).not.toMatch(/role:\s*"customer"/);
    expect(src).not.toMatch(/role:\s*"user"/);
    expect(src).not.toMatch(/role:\s*"assistant"/);
  });

  it("ai/evaluate route 仍走 evaluateSimulation 不变 service 调用", () => {
    const src = readFile("app/api/ai/evaluate/route.ts");
    expect(src).toMatch(/await\s+evaluateSimulation\(/);
  });
});
