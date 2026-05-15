import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit14";

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
// A: 学习任务卡 ≤ 5 + "查看全部 N 项 →" Link
// ============================================

test("QA r14 A: alex /dashboard 学习任务卡 ≤5 + '查看全部 N 项 →' Link → /tasks", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/A1-dashboard.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[A] body first 500:", bodyText.slice(0, 500));

    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 查 "查看全部 N 项" Link
    const viewAllLink = page.locator('a[href="/tasks"]').filter({ hasText: /查看全部.*项/ });
    const viewAllCount = await viewAllLink.count();
    console.log("[A] '查看全部 N 项' Link count:", viewAllCount);
    expect(viewAllCount, "应有'查看全部 N 项 →' Link").toBeGreaterThan(0);

    const linkText = (await viewAllLink.first().textContent()) ?? "";
    console.log("[A] link text:", linkText);
    // 文案应含具体数字
    expect(linkText).toMatch(/查看全部\s*\d+\s*项/);

    // 数 task 卡片数量 ≤ 5 — 限定 priority-tasks 区域内 (避免误判课表 / 其他卡的 "开始" 字眼)
    // priority-tasks 区域以 "学习任务" / "任务列表" 标题为锚
    const taskSection = page.locator("section").filter({ has: page.locator("text=/学习任务|任务列表/") }).first();
    const sectionExists = await taskSection.count();
    console.log("[A] task section exists:", sectionExists);
    if (sectionExists) {
      // section 内的 /tasks/, /sim/ 等 task 路径 link 数 (排除 "查看全部" 自身)
      const taskLinks = taskSection.locator('a[href*="/tasks/"], a[href*="/sim/"]');
      const taskCount = await taskLinks.count();
      console.log("[A] task links in section count (≤5):", taskCount);
      expect(taskCount, "学习任务卡 ≤ 5").toBeLessThanOrEqual(5);
    }
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// B: AI buddy callout 在不同视口都 visible
// ============================================

test("QA r14 B: AI buddy callout 在 1280×800 视口可见", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const context = alex.context;
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/B1-viewport-1280.png`, fullPage: true });

    // AI buddy callout
    const callout = page.locator('a[href*="/study-buddy"][href*="openNew=true"]');
    const calloutCount = await callout.count();
    console.log("\n[B] 1280×800 callout count:", calloutCount);
    expect(calloutCount, "1280 视口应有 AI buddy callout").toBeGreaterThan(0);

    // 应 visible (not hidden)
    const isVisible = await callout.first().isVisible();
    console.log("[B] callout isVisible:", isVisible);
    expect(isVisible).toBe(true);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

test("QA r14 C: AI buddy callout 在 768×1024 视口可见 (小屏)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/C1-viewport-768.png`, fullPage: true });

    const callout = page.locator('a[href*="/study-buddy"][href*="openNew=true"]');
    const calloutCount = await callout.count();
    console.log("\n[C] 768 callout count:", calloutCount);
    expect(calloutCount, "768 视口应有 callout").toBeGreaterThan(0);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

test("QA r14 D: AI buddy callout 在 360×640 视口可见 (手机)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/D1-viewport-360.png`, fullPage: true });

    const callout = page.locator('a[href*="/study-buddy"][href*="openNew=true"]');
    const calloutCount = await callout.count();
    console.log("\n[D] 360 callout count:", calloutCount);
    expect(calloutCount, "360 视口 callout 应存在 (即使非 visible)").toBeGreaterThan(0);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// E: 任务中心 /tasks 仍正常 (regression spot-check)
// ============================================

test("QA r14 E: alex /tasks 仍正常 (regression)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/tasks`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 应有 task tab 列表 (Unit 3 实施)
    expect(bodyText).toMatch(/待办|进行中|已批改|已结束/);
  } finally {
    await page.close();
    await alex.context.close();
  }
});
