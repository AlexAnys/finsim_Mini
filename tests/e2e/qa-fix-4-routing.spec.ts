import { test, type Page, expect } from "@playwright/test";

const BASE = "http://localhost:3002";
const SIM_TASK_INSTANCE_ID = "00000000-0000-4000-8000-00000000a602"; // ANL-2 客户风险评估模拟

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

test("student chat with taskInstanceId → uses teacher's qwen setting", async ({ page }) => {
  await login(page, "student1@finsim.edu.cn", "password123");
  const t0 = Date.now();
  const out = await page.evaluate(async (instId) => {
    const r = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        taskInstanceId: instId,
        transcript: [{ role: "student", text: "你好。" }],
        scenario: "测试。",
      }),
    });
    if (!r.body) return { status: r.status };
    const text = await r.text();
    return { status: r.status, length: text.length, sample: text.slice(0, 600) };
  }, SIM_TASK_INSTANCE_ID);
  console.log("elapsed:", Date.now() - t0, "ms");
  console.log("chat result:", JSON.stringify(out));
  expect(out.status).toBeGreaterThanOrEqual(200);
});
