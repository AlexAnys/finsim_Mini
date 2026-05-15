import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";

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

test("chat latency benchmark x3", async ({ page }) => {
  await login(page, "student1@finsim.edu.cn", "password123");
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const result = await page.evaluate(async () => {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: [{ role: "student", text: "你好，我想咨询一下退休理财方案。" }],
          scenario: "客户是一位 35 岁的中学教师，月薪 1.5 万，希望 60 岁退休。",
        }),
      });
      return { status: r.status, body: (await r.text()).slice(0, 300) };
    });
    const latency = Date.now() - t0;
    console.log(JSON.stringify({ turn: i + 1, latencyMs: latency, status: result.status, preview: result.body }));
  }
});
