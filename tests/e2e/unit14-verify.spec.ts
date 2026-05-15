import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit14-verify";

async function makeAuthedContext(
  browser: import("@playwright/test").Browser,
  email: string,
  password: string,
): Promise<{ context: BrowserContext; request: APIRequestContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page
      .waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 })
      .catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  for (let i = 0; i < 20; i++) {
    const r = await context.request.get(`${BASE}/api/auth/session`);
    const j = await r.json();
    if (j?.user?.email === email) {
      await page.close();
      return { context, request: context.request };
    }
    await page.waitForTimeout(500);
  }
  await page.close();
  throw new Error(`login failed for ${email}`);
}

test.setTimeout(180_000);

// ============================================
// A1: priority-tasks 仅显示前 5 项 + "查看全部 → /tasks"
// ============================================
test("A1: student dashboard 学习任务卡仅显示 ≤5 项 + 查看全部 Link", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  // priority-tasks section title
  const section = page.locator('section:has(h2:has-text("学习任务"))').first();
  await expect(section).toBeVisible({ timeout: 10_000 });

  // 计数子标题 "共 N 项"
  const subtitle = await section.textContent();
  expect(subtitle).toBeTruthy();
  const totalMatch = subtitle?.match(/共\s*(\d+)\s*项/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

  // 任务卡数量 ≤ 5
  const taskRows = section.locator('div.rounded-xl.border.bg-surface').filter({
    has: page.locator("text=/开始|查看|结果/"),
  });
  const renderedCount = await taskRows.count();
  expect(renderedCount).toBeLessThanOrEqual(5);

  // 如果总数 > 5，应有"查看全部 N 项 →" Link
  if (total > 5) {
    const seeAllLink = page.locator('a[href="/tasks"]:has-text("查看全部")');
    await expect(seeAllLink.first()).toBeVisible();
    const text = await seeAllLink.first().textContent();
    expect(text).toContain(String(total));
  }

  await page.screenshot({ path: `${SS}/A1-priority-tasks.png`, fullPage: true });
  await context.close();
});

// ============================================
// B1: AI callout 在 1280 + 360 视口都可见
// ============================================
test("B1: AI buddy callout compact 在 1280px (xl) 视口 visible", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  // compact callout Link href="/study-buddy?openNew=true"
  const callout = page.locator('a[href="/study-buddy?openNew=true"]').first();
  await expect(callout).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: `${SS}/B1-callout-1280.png` });
  await context.close();
});

test("B2: AI buddy callout compact 在 360px (mobile) 视口 visible", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await context.newPage();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const callout = page.locator('a[href="/study-buddy?openNew=true"]').first();
  await expect(callout).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: `${SS}/B2-callout-360.png` });
  await context.close();
});

test("B3: AI buddy callout compact 在 768px (tablet) 视口 visible", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await context.newPage();
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const callout = page.locator('a[href="/study-buddy?openNew=true"]').first();
  await expect(callout).toBeVisible({ timeout: 10_000 });

  await context.close();
});
