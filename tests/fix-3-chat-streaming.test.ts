import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Fix 3 (review fixes batch 1) · Chat 流式 SSE
 *
 * baseline：chat-bench 实测连续 3 轮 18051 / 24101 / 26044 ms，无流式渲染。
 * 目标：首 chunk ≤ 2s，整体 ≤ 10s（≥50% 提升），SSE 渲染可见。
 *
 * 静态扫描守护：流式契约、30s 超时、SSE 协议事件、handleSend / handleSubmitAllocation
 * 都接 SSE，错误中文、bullet 旧 JSON 路径仍保留（向后兼容 curl / 非浏览器调用）。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Fix 3 · ai.service 流式 API", () => {
  it("导出 chatReplyStream + ChatReplyStreamResult + CHAT_STREAM_TIMEOUT_MS", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toMatch(/export\s+async\s+function\s+chatReplyStream\b/);
    expect(src).toMatch(/export\s+interface\s+ChatReplyStreamResult\b/);
    expect(src).toMatch(/export\s+const\s+CHAT_STREAM_TIMEOUT_MS\s*=\s*30_000/);
  });

  it("chatReplyStream 内部使用 streamText（不再是 generateText 同步路径）", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toMatch(/import\s+\{[^}]*streamText[^}]*\}\s+from\s+"ai"/);
    // chatReplyStream 函数体内调用 streamText
    const startIdx = src.indexOf("export async function chatReplyStream(");
    expect(startIdx).toBeGreaterThan(0);
    const fnBody = src.slice(startIdx, startIdx + 4000);
    expect(fnBody).toContain("streamText({");
    expect(fnBody).toContain("abortSignal");
  });

  it("30 秒 AbortController 上限生效", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toContain("new AbortController()");
    expect(src).toContain("CHAT_STREAM_TIMEOUT_MS");
    // setTimeout(... abort ...) 模式
    expect(src).toMatch(/setTimeout\(\(\) => abortController\.abort\(\)/);
  });

  it("流式失败兜底与 chatReply 同款（NEUTRAL/0.5/degraded=true）", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toContain("degradedFallback");
    expect(src).toMatch(/degraded:\s*true/);
    expect(src).toMatch(/mood:\s*\{\s*score:\s*0\.3,\s*key:\s*"NEUTRAL",\s*label:\s*"犹豫"\s*\}/);
    expect(src).toMatch(/studentPerf:\s*0\.5/);
  });

  it("共享 prompt 构造（chatReply 与 chatReplyStream 不重复字面量）", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toContain("function buildChatPrompts(");
    expect(src).toContain("async function finalizeChatReply(");
    // chatReply 与 chatReplyStream 都调用 buildChatPrompts
    const matches = src.match(/buildChatPrompts\(data\)/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("不破坏 mimo reasoning fix（da9a505）— reasoningEffort 仍是 SDK 白名单路径", () => {
    const src = readFile("lib/services/ai.service.ts");
    expect(src).toMatch(/reasoningEffort:\s*thinking\s*===\s*"enabled"\s*\?\s*"high"\s*:\s*"none"/);
  });
});

describe("Fix 3 · /api/ai/chat route SSE 通道", () => {
  it("route 导入 chatReplyStream + 按 Accept: text/event-stream 切换通道", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toMatch(/import\s+\{[^}]*chatReplyStream[^}]*\}\s+from\s+"@\/lib\/services\/ai\.service"/);
    expect(src).toMatch(/text\/event-stream/);
    expect(src).toContain("streamChatResponse");
  });

  it("SSE 协议事件齐全：chunk / meta / error / done", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toMatch(/send\("chunk"/);
    expect(src).toMatch(/send\("meta"/);
    expect(src).toMatch(/send\("error"/);
    expect(src).toMatch(/send\("done"/);
  });

  it("超时/限流/未配置 等错误码都映射成中文 SSE error 事件", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toContain("AI 回复超时，请稍后再试");
    expect(src).toContain("请求频率超限，请稍后再试");
    expect(src).toContain("AI 服务未配置");
    expect(src).toContain("AI 服务暂时不可用，请稍后重试");
  });

  it("旧 JSON 路径保留（Accept 不带 text/event-stream 时仍调 chatReply）", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toMatch(/await\s+chatReply\(/);
    // 仍 return success({...}) 维持原 JSON 协议
    expect(src).toMatch(/return\s+success\(\{[\s\S]*?reply:\s*out\.reply/);
  });

  it("nginx SSE buffer disable 头（X-Accel-Buffering: no）", () => {
    const src = readFile("app/api/ai/chat/route.ts");
    expect(src).toMatch(/"X-Accel-Buffering":\s*"no"/);
    expect(src).toMatch(/"Cache-Control":\s*"no-store/);
  });
});

describe("Fix 3 · simulation-runner.tsx SSE 渲染", () => {
  it("streamChatTurn 共享 helper 存在 + 解析 SSE chunk/meta/error/done 事件", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toContain("async function streamChatTurn(");
    expect(src).toContain("function parseSseEvent(");
    expect(src).toMatch(/evt\.event === "chunk"/);
    expect(src).toMatch(/evt\.event === "meta"/);
    expect(src).toMatch(/evt\.event === "error"/);
    expect(src).toMatch(/evt\.event === "done"/);
  });

  it("fetch 带 Accept: text/event-stream + AbortController", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toMatch(/Accept:\s*"text\/event-stream"/);
    expect(src).toContain("new AbortController()");
  });

  it("chunk 进来立即增量 setMessages（流式渲染）", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toMatch(/accumulatedReply\s*\+=\s*delta/);
    // 把累计 reply 渲染到对应 aiMsgId 的消息上
    expect(src).toMatch(/m\.id === aiMsgId/);
  });

  it("handleSend 与 handleSubmitAllocation 都委派给 streamChatTurn（消除复制）", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toMatch(/async function handleSend\(\)[\s\S]+?await streamChatTurn\(\{/);
    expect(src).toMatch(/async function handleSubmitAllocation\(\)[\s\S]+?await streamChatTurn\(\{/);
  });

  it("PR-7B B3 hint 节流逻辑保留（lastHintTurn 仍从 transcript 推导）", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toMatch(/let lastHintTurn:\s*number\s*\|\s*undefined/);
    expect(src).toMatch(/if \(m\.role === "ai" && m\.hint\) lastHintTurn = runningStudentTurns/);
  });

  it("中文错误：超时 / 失败 / 提交失败 — 全保留", () => {
    const src = readFile("components/simulation/simulation-runner.tsx");
    expect(src).toContain("AI 回复超时，请稍后再试");
    expect(src).toContain("发送消息失败，请重试");
    expect(src).toContain("提交失败，请重试");
  });
});
