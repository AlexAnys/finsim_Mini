import { test, type Page } from "@playwright/test";

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

test("dump raw SSE body", async ({ page }) => {
  await login(page, "student1@finsim.edu.cn", "password123");
  const out = await page.evaluate(async () => {
    const r = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        transcript: [{ role: "student", text: "你好，请帮我推荐一个稳健型理财方案，包含基金和债券，月薪 1.5 万，希望明确产品类别和比例。" }],
        scenario: "客户 35 岁中学教师，月薪 1.5 万，期望 60 岁退休，风险厌恶。",
      }),
    });
    if (!r.body) return { status: r.status, raw: null };
    // Read entire body raw (not eventsource)
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let firstChunkMs: number | null = null;
    const t0 = performance.now();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (firstChunkMs === null) firstChunkMs = performance.now() - t0;
      raw += decoder.decode(value, { stream: true });
    }
    return { status: r.status, raw, totalMs: performance.now() - t0, firstChunkMs };
  });
  console.log("STATUS=", out.status, "FIRST_READ_MS=", out.firstChunkMs, "TOTAL_MS=", out.totalMs);
  console.log("--- RAW BODY (first 5000) ---");
  console.log((out.raw || "").slice(0, 5000));
  console.log("--- END (length:" + (out.raw?.length ?? 0) + ") ---");
});
