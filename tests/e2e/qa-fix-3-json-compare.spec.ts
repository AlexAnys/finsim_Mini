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

test("compare JSON (old generateText) vs SSE (new streamText)", async ({ page }) => {
  await login(page, "student1@finsim.edu.cn", "password123");
  // Old path: no Accept: text/event-stream
  const out = await page.evaluate(async () => {
    const t0 = performance.now();
    const r = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: [{ role: "student", text: "你好，请帮我推荐稳健型理财组合。" }],
        scenario: "客户 35 岁中学教师，月薪 1.5 万，期望 60 岁退休。",
      }),
    });
    const totalMs = performance.now() - t0;
    const body = await r.json();
    return { status: r.status, totalMs, body };
  });
  console.log("JSON path:", JSON.stringify(out).slice(0, 1500));
});
