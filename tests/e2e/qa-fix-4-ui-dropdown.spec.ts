import { test, type Page, expect } from "@playwright/test";

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

test("UI: click provider Select trigger → 5 options visible in dropdown", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/ai-settings`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);

  // Find first provider Select trigger (shadcn-style — button with role=combobox)
  const triggers = await page.locator('button[role="combobox"]').all();
  console.log("combobox triggers found:", triggers.length);
  expect(triggers.length).toBeGreaterThan(0);

  // Click the first one to open the dropdown
  await triggers[0].click();
  await page.waitForTimeout(500);

  // Collect option labels
  const items = await page.locator('[role="option"]').allTextContents();
  console.log("option labels:", JSON.stringify(items));
  await page.screenshot({ path: "test-results/qa-fix-4-dropdown-open.png", fullPage: true });

  // 5 provider labels must all be in options
  const joined = items.join("|");
  expect(joined).toMatch(/小米.*MiMo|MiMo/);
  expect(joined).toMatch(/通义千问|qwen/i);
  expect(joined).toMatch(/DeepSeek/i);
  expect(joined).toMatch(/Gemini/i);
  expect(joined).toMatch(/OpenAI/i);
});
