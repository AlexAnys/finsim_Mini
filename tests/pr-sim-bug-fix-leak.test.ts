import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Bug fix: 学生上 simulation 报"学生不允许传入自定义系统提示" + 同浏览器
 * teacher preview 内容串到 student 账号。两个独立 bug 一起修：
 *
 * 1. systemPrompt 403 — chat route 拒绝学生 systemPrompt 但 runner 透传
 *    SimulationConfig.systemPrompt → 凡是教师设了自定义 prompt 的任务全炸。
 *    修：chat route 学生身份时服务端从 SimulationConfig fetch systemPrompt，
 *    忽略客户端值（仍防注入）。教师/admin preview 仍可传客户端值。
 *
 * 2. localStorage draft 串数据 — DRAFT_KEY 只用 taskInstanceId，没 userId 也没
 *    preview/live 区分。同浏览器先教师 preview 后学生登录 → 学生看到/提交教师
 *    测试 messages、snapshots、allocations，造成错误归因。3 个 runner（sim/
 *    quiz/subjective）都有同样模式。修：key 加 userId + preview/live。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Bug 1 · /api/ai/chat: 学生 systemPrompt 不再 403", () => {
  it("路由不再返回 forbidden(\"学生不允许传入自定义系统提示\")", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).not.toContain("学生不允许传入自定义系统提示");
    // forbidden import 应该已经移除（否则 lint 会警告 unused import）
    expect(src).not.toMatch(/import\s+\{[^}]*forbidden[^}]*\}\s+from\s+"@\/lib\/api-utils"/);
  });

  it("加了 resolveSystemPrompt helper：学生忽略客户端 systemPrompt，从 task config 拉权威值", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toContain("function resolveSystemPrompt");
    // 逻辑必须区分学生/教师
    expect(src).toMatch(/role\s*===\s*"student"/);
    // 教师 client value 优先（preview 自定义 prompt 测试场景）
    expect(src).toMatch(/!isStudent[\s\S]*?clientValue/);
    // 必须从 simulationConfig 拉 systemPrompt
    expect(src).toMatch(/simulationConfig[\s\S]*?systemPrompt/);
  });

  it("chatReply 调用时 systemPrompt 走 trustedSystemPrompt 而非客户端原值", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toContain("trustedSystemPrompt");
    expect(src).toMatch(/systemPrompt:\s*trustedSystemPrompt/);
  });
});

describe("Bug 2 · 3 个 runner localStorage draft 隔离", () => {
  describe("simulation-runner", () => {
    it("buildDraftKey helper 存在并包含 userId + preview/live + taskInstanceId", () => {
      const src = readFile("components/simulation/simulation-runner.tsx");
      expect(src).toContain("function buildDraftKey");
      // key 模板必须三维都有
      expect(src).toMatch(/\$\{userId\}_\$\{isPreview\s*\?\s*"preview"\s*:\s*"live"\}_\$\{taskInstanceId\}/);
    });

    it("不再有 raw DRAFT_KEY_PREFIX + taskInstanceId 用法", () => {
      const src = readFile("components/simulation/simulation-runner.tsx");
      expect(src).not.toMatch(/DRAFT_KEY_PREFIX\s*\+\s*taskInstanceId/);
    });

    it("Props 包含 userId: string", () => {
      const src = readFile("components/simulation/simulation-runner.tsx");
      // Props interface 含 userId
      expect(src).toMatch(/interface SimulationRunnerProps[\s\S]{0,500}userId:\s*string/);
    });
  });

  describe("subjective-runner", () => {
    it("buildDraftKey + 不再 raw 拼接", () => {
      const src = readFile("components/subjective/subjective-runner.tsx");
      expect(src).toContain("function buildDraftKey");
      expect(src).not.toMatch(/DRAFT_KEY_PREFIX\s*\+\s*taskInstanceId/);
      expect(src).toMatch(/\$\{userId\}_\$\{isPreview\s*\?\s*"preview"\s*:\s*"live"\}_\$\{taskInstanceId\}/);
    });

    it("Props 含 userId", () => {
      const src = readFile("components/subjective/subjective-runner.tsx");
      expect(src).toMatch(/interface SubjectiveRunnerProps[\s\S]{0,500}userId:\s*string/);
    });
  });

  describe("quiz-runner", () => {
    it("buildDraftKey + 不再 raw 拼接", () => {
      const src = readFile("components/quiz/quiz-runner.tsx");
      expect(src).toContain("function buildDraftKey");
      expect(src).not.toMatch(/DRAFT_KEY_PREFIX\s*\+\s*taskInstanceId/);
      expect(src).toMatch(/\$\{userId\}_\$\{isPreview\s*\?\s*"preview"\s*:\s*"live"\}_\$\{taskInstanceId\}/);
    });

    it("Props 含 userId", () => {
      const src = readFile("components/quiz/quiz-runner.tsx");
      expect(src).toMatch(/interface QuizRunnerProps[\s\S]{0,500}userId:\s*string/);
    });
  });
});

describe("Bug 2 · parent pages 传 userId", () => {
  it("sim/[id]/page.tsx 用 useSession 并把 userId 传给 SimulationRunner", () => {
    const src = readFile("app/(simulation)/sim/[id]/page.tsx");
    expect(src).toMatch(/from\s+"next-auth\/react"/);
    expect(src).toMatch(/useSession\(\)/);
    expect(src).toMatch(/userId={userId}/);
    // 必须 gate session 加载（防止 userId=undefined 时 runner 已 mount）
    expect(src).toMatch(/if\s*\(!userId\)/);
  });

  it("(student)/tasks/[id]/page.tsx 同上 + 把 userId 传给 Quiz/Subjective Runner", () => {
    const src = readFile("app/(student)/tasks/[id]/page.tsx");
    expect(src).toMatch(/from\s+"next-auth\/react"/);
    expect(src).toMatch(/useSession\(\)/);
    expect(src).toMatch(/userId={userId}/);
    // renderRunner 签名改为接收 userId 参数
    expect(src).toMatch(/function renderRunner\([^)]*userId:\s*string/);
  });
});
