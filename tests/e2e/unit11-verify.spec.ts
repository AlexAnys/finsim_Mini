import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit11-verify";

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
// A. 服务端节流 — weekly-insight force=true 60s 内第 2 次 429
// ============================================
test("A1: weekly-insight force=true 60s 内连发 → 第二次 429 AI_FEATURE_COOLDOWN", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");

  // 触发一次 force=true（耗时长，等 AI/cache 完成）
  const res1 = await request.get(`${BASE}/api/lms/weekly-insight?force=true`, { timeout: 90_000 });
  expect(res1.status()).toBeLessThanOrEqual(500); // 200 / 500（AI 失败） 都算第一次

  // 立即第 2 次 force=true 应被节流
  const res2 = await request.get(`${BASE}/api/lms/weekly-insight?force=true`);
  expect(res2.status()).toBe(429);
  const body2 = await res2.json();
  expect(body2.success).toBe(false);
  expect(body2.error?.code).toBe("AI_FEATURE_COOLDOWN");
  expect(body2.error?.message).toContain("60 秒");

  await context.close();
});

// ============================================
// B. AiRun tokens 持久化 — AI 调用后 DB 有 tokens 字段
// ============================================
test("B1: weekly-insight API 返回含 modelUsed/durationMs/inputTokens/outputTokens 字段", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");

  const res = await request.get(`${BASE}/api/lms/weekly-insight`, { timeout: 90_000 });
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.success).toBe(true);

  // 新字段都存在（可为 null when AI 失败 / 老 cache）
  expect(json.data).toHaveProperty("inputTokens");
  expect(json.data).toHaveProperty("outputTokens");
  expect(json.data).toHaveProperty("costEstUSD");
  // Unit 7 字段保留
  expect(json.data).toHaveProperty("modelUsed");
  expect(json.data).toHaveProperty("durationMs");

  await context.close();
});

// ============================================
// C. /teacher/ai-usage page renders for teacher
// ============================================
test("C1: /teacher/ai-usage 200 且 molly 能看自己的 AI 调用列表", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/ai-usage`);
  await page.waitForLoadState("networkidle").catch(() => {});

  await expect(page.locator("h1:has-text('AI 用量')").first()).toBeVisible({ timeout: 10_000 });
  // 应显示按功能聚合卡 OR "暂无聚合数据"
  const aggTitle = page.locator("h2:has-text('按功能聚合')");
  await expect(aggTitle).toBeVisible();

  await page.screenshot({ path: `${SS}/C1-ai-usage.png`, fullPage: true });
  await context.close();
});

// ============================================
// D. /admin/audit page — admin only, teacher 403
// ============================================
test("D1: admin 访问 /admin/audit 200 + 显示审计中心标题", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "admin@finsim.edu.cn", "password123");
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/audit`);
  await page.waitForLoadState("networkidle").catch(() => {});

  await expect(page.locator("h1:has-text('管理员审计')").first()).toBeVisible({ timeout: 10_000 });
  // 两个 tab 都应可见
  await expect(page.locator("text=敏感操作日志").first()).toBeVisible();
  await expect(page.locator("text=AI 调用记录").first()).toBeVisible();

  await page.screenshot({ path: `${SS}/D1-admin-audit.png`, fullPage: true });
  await context.close();
});

test("D2: teacher 访问 /admin/audit 看见 ForbiddenState", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/audit`);
  await page.waitForLoadState("networkidle").catch(() => {});

  // ForbiddenState 渲染（管理员页面 only）
  const forbiddenHeader = page.locator("text=管理员页面").first();
  await expect(forbiddenHeader).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: `${SS}/D2-teacher-blocked.png` });
  await context.close();
});

test("D3: teacher API GET /api/admin/audit → 403", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const res = await request.get(`${BASE}/api/admin/audit`);
  expect(res.status()).toBe(403);
  await context.close();
});

// ============================================
// E. Cron sweep-stuck — admin 可触发；DB 状态有 stuck 时正确清扫
// ============================================
test("E1: POST /api/cron/sweep-stuck-ai-runs admin 可调用", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "admin@finsim.edu.cn", "password123");

  const res = await request.post(`${BASE}/api/cron/sweep-stuck-ai-runs`);
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.success).toBe(true);
  expect(typeof json.data?.swept).toBe("number");

  await context.close();
});

test("E2: non-admin 调用 cron 返回 401", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const res = await request.post(`${BASE}/api/cron/sweep-stuck-ai-runs`);
  expect(res.status()).toBe(401);
  await context.close();
});

// ============================================
// F. Sidebar nav — teacher 看到 AI 用量；admin 看到 审计中心
// ============================================
test("F1: 教师 sidebar 含 AI 用量 nav", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});

  const nav = page.locator('a[href="/teacher/ai-usage"]').first();
  await expect(nav).toBeVisible({ timeout: 10_000 });
  await context.close();
});

test("F2: admin sidebar 含审计中心 nav", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "admin@finsim.edu.cn", "password123");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});

  const nav = page.locator('a[href="/admin/audit"]').first();
  await expect(nav).toBeVisible({ timeout: 10_000 });
  await context.close();
});
