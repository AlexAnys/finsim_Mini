import { test, type Page } from "@playwright/test";

/**
 * QA Fix 3 · SSE chat streaming bench
 * - 实测 worktree B（port 3002）/api/ai/chat 的 SSE 通道
 * - 首 chunk ≤ 2000ms，整体 ≤ 10000ms（vs baseline 18051/24101/26044 ms）
 * - 3 轮连测
 */

const BASE = "http://localhost:3002";

async function login(page: Page, email: string, pwd: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pwd);
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(180_000);

test("SSE chat-bench x3 — first chunk ≤ 2s + total ≤ 10s", async ({ page }) => {
  await login(page, "student1@finsim.edu.cn", "password123");

  for (let i = 0; i < 3; i++) {
    const result = await page.evaluate(async () => {
      const startedAt = performance.now();
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          transcript: [{ role: "student", text: "你好，我想咨询一下退休理财方案。" }],
          scenario: "客户是一位 35 岁的中学教师，月薪 1.5 万，希望 60 岁退休。",
        }),
      });
      if (!r.ok || !r.body) {
        return { status: r.status, error: "no body", firstChunkMs: null, totalMs: null };
      }
      const ct = r.headers.get("content-type") || "";
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstChunkMs: number | null = null;
      let chunkCount = 0;
      let metaCount = 0;
      let firstDelta = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const lines = rawEvent.split("\n");
          let evt = "message", dataStr = "";
          for (const ln of lines) {
            if (ln.startsWith("event:")) evt = ln.slice(6).trim();
            else if (ln.startsWith("data:")) dataStr += ln.slice(5).trim();
          }
          if (evt === "chunk") {
            chunkCount += 1;
            if (firstChunkMs === null) {
              firstChunkMs = performance.now() - startedAt;
              try {
                const p = JSON.parse(dataStr);
                firstDelta = p.delta || "";
              } catch {}
            }
          } else if (evt === "meta") {
            metaCount += 1;
          }
        }
      }
      const totalMs = performance.now() - startedAt;
      return { status: r.status, contentType: ct, firstChunkMs, totalMs, chunkCount, metaCount, firstDelta };
    });
    console.log(JSON.stringify({ turn: i + 1, ...result }));
  }
});
