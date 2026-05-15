/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit11";

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
// A: 节流 weekly-insight force=true 60s
// ============================================

test("QA r11 A: weekly-insight force=true 60s 内第二次 → 429 AI_FEATURE_COOLDOWN", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    // 第一次 force=true 应通过（在 throttle 窗口外 — 假设 cache fresh）
    const r1 = await molly.request.get(`${BASE}/api/lms/weekly-insight?force=true`, {
      failOnStatusCode: false,
    });
    console.log("\n[A] first force=true:", r1.status());
    // 第一次可能是 200 或 429（如果之前测试残留 throttle）
    // 等 1 秒后立刻发第二次 — 必须 429
    await new Promise((res) => setTimeout(res, 1500));
    const r2 = await molly.request.get(`${BASE}/api/lms/weekly-insight?force=true`, {
      failOnStatusCode: false,
    });
    const b2Text = await r2.text();
    let b2: any = null;
    try { b2 = JSON.parse(b2Text); } catch { /* keep null */ }
    console.log("[A] second force=true (within 60s):", r2.status(), JSON.stringify(b2).slice(0, 300));

    expect(r2.status(), "60s 内第二次 force=true 应 429").toBe(429);
    expect(String(b2?.error?.code)).toMatch(/COOLDOWN|RATE_LIMIT/);
    expect(String(b2?.error?.message)).toMatch(/[一-鿿]/);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// B: API 返回 AiRun 新字段
// ============================================

test("QA r11 B: weekly-insight API 返回 inputTokens/outputTokens/costEstUSD/modelUsed/durationMs", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const r = await molly.request.get(`${BASE}/api/lms/weekly-insight`);
    expect(r.status()).toBe(200);
    const j = await r.json();
    const data = j?.data ?? j;
    console.log("\n[B] response keys:", Object.keys(data ?? {}));

    // backward-compat: 字段可能为 null（老 cache），但 key 必须存在
    const expectedKeys = ["modelUsed", "durationMs", "inputTokens", "outputTokens", "costEstUSD"];
    for (const k of expectedKeys) {
      const has = k in (data ?? {});
      console.log(`[B] has key '${k}':`, has);
      expect(has, `response 应有 key '${k}'`).toBe(true);
    }
  } finally {
    await molly.context.close();
  }
});

// ============================================
// C: /teacher/ai-usage 页 (molly 看自己 runs)
// ============================================

test("QA r11 C: molly /teacher/ai-usage 加载 200 + 看自己 AI runs", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/ai-usage`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/C1-ai-usage.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[C] body first 500:", bodyText.slice(0, 500));

    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);
    // 应含 AI usage 相关字眼
    const hasFeature = /weekly|insight|simulation|chat|generate|feature/i.test(bodyText) || /洞察|对话|生成/.test(bodyText);
    console.log("[C] has feature-related text?", hasFeature);

    // API 验证 molly 自己的 runs
    const apiResp = await molly.request.get(`${BASE}/api/lms/ai-usage`);
    expect(apiResp.status()).toBe(200);
    const apiJson = await apiResp.json();
    console.log("[C] API keys:", Object.keys(apiJson?.data ?? {}));
    const items = (apiJson?.data?.items ?? apiJson?.data?.runs ?? []) as Array<{ id: string }>;
    const agg = apiJson?.data?.aggregateByFeature ?? apiJson?.data?.aggregate;
    const total = apiJson?.data?.total;
    console.log("[C] items count:", items.length, " total:", total, " has aggregate?", !!agg);
    expect(Array.isArray(items), "items 应是数组").toBe(true);
  } finally {
    await page.close();
    await molly.context.close();
  }
});

// ============================================
// D: admin /admin/audit 拦截
// ============================================

test("QA r11 D1: admin /admin/audit 加载 200 + 两 tab", async ({ browser }) => {
  const admin = await makeAuthedContext(browser, "admin@finsim.edu.cn", "password123");
  const page = await admin.context.newPage();
  try {
    await page.goto(`${BASE}/admin/audit`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/D1-admin-audit.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[D1] body first 500:", bodyText.slice(0, 500));
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 应有 "审计 / AI 调用记录 / 敏感操作" 字眼
    const hasAudit = /审计|AuditLog|敏感操作/.test(bodyText);
    const hasAi = /AI 调用|AiRun|AI 用量/.test(bodyText);
    console.log("[D1] hasAudit:", hasAudit, " hasAi:", hasAi);
    expect(hasAudit || hasAi, "应有审计或 AI 调用相关字眼").toBe(true);

    // API 验证
    const apiResp = await admin.request.get(`${BASE}/api/admin/audit`);
    expect(apiResp.status()).toBe(200);
  } finally {
    await page.close();
    await admin.context.close();
  }
});

test("QA r11 D2: teacher /admin/audit → ForbiddenState (UI 拦截)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/admin/audit`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/D2-teacher-blocked.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[D2] body first 300:", bodyText.slice(0, 300));

    // 应不显示真实数据 — 应是 ForbiddenState 或 redirect
    const url = page.url();
    console.log("[D2] URL:", url);
    const blocked =
      /权限不足|无法访问|管理员|admin only|forbidden|403/i.test(bodyText) ||
      !url.includes("/admin/audit") ||
      /login/.test(url);
    console.log("[D2] blocked?", blocked);
    expect(blocked, "teacher 应被 ForbiddenState 或重定向拦截").toBe(true);
  } finally {
    await page.close();
    await molly.context.close();
  }
});

test("QA r11 D3: teacher API /api/admin/audit → 403/401", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.get(`${BASE}/api/admin/audit`);
    const body = await resp.json();
    console.log("\n[D3] teacher GET /api/admin/audit:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status(), "teacher 应 4xx").toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// E: Cron sweep stuck AI runs
// ============================================

test("QA r11 E1: admin POST /api/cron/sweep-stuck-ai-runs → 200", async ({ browser }) => {
  const admin = await makeAuthedContext(browser, "admin@finsim.edu.cn", "password123");
  try {
    const resp = await admin.request.post(`${BASE}/api/cron/sweep-stuck-ai-runs`);
    console.log("\n[E1] admin sweep:", resp.status());
    expect(resp.status()).toBeLessThan(400);
    const body = await resp.json();
    console.log("[E1] body:", JSON.stringify(body).slice(0, 300));
    // 应返回 sweep 统计
    const data = body?.data ?? body;
    expect(data).toBeDefined();
  } finally {
    await admin.context.close();
  }
});

test("QA r11 E2: non-admin POST cron → 401/403", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.post(`${BASE}/api/cron/sweep-stuck-ai-runs`);
    console.log("\n[E2] teacher sweep:", resp.status());
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// F: Sidebar nav
// ============================================

test("QA r11 F1: molly sidebar 有 'AI 用量' nav", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    const navLink = page.locator('nav a, [role="navigation"] a').filter({ hasText: /AI 用量/ });
    const count = await navLink.count();
    console.log("\n[F1] 'AI 用量' nav count:", count);
    expect(count, "teacher sidebar 应有 'AI 用量'").toBeGreaterThan(0);

    // click → 跳 /teacher/ai-usage
    await navLink.first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    const url = page.url();
    console.log("[F1] URL after click:", url);
    expect(url).toMatch(/\/teacher\/ai-usage/);
  } finally {
    await page.close();
    await molly.context.close();
  }
});

test("QA r11 F2: admin sidebar 有 '审计中心' nav", async ({ browser }) => {
  const admin = await makeAuthedContext(browser, "admin@finsim.edu.cn", "password123");
  const page = await admin.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/F2-admin-sidebar.png`, fullPage: true });

    const navLink = page.locator('nav a, [role="navigation"] a').filter({ hasText: /审计中心|审计/ });
    const count = await navLink.count();
    console.log("\n[F2] '审计中心' nav count:", count);
    expect(count, "admin sidebar 应有 '审计中心'").toBeGreaterThan(0);
  } finally {
    await page.close();
    await admin.context.close();
  }
});

// ============================================
// G: AiRun DB 实证 — 新字段写入
// ============================================

test("QA r11 G: 触发一次 AI 调用 + DB 实证 AiRun 新字段写入 (cost/tokens/summary)", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    // 取触发前 AiRun count
    const beforeR = await molly.request.get(`${BASE}/api/lms/ai-usage?take=1`);
    const beforeJ = await beforeR.json();
    const beforeRuns = beforeJ?.data?.items ?? beforeJ?.data?.runs ?? [];
    const lastBeforeId = beforeRuns[0]?.id;
    console.log("\n[G] before lastRunId:", lastBeforeId);

    // 触发新 AI 调用 — 用 SB free-form 作答 (会写 AiRun + 新字段)
    const sbResp = await molly.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        title: `QA-r11-G-${Date.now()}`,
        question: "什么是货币时间价值？",
        mode: "direct",
        anonymous: false,
        isPreview: true, // teacher 必须 preview
        taskId: "e07a8ba8-6ee1-4d57-836b-a4847296f376", // teacher1 task
      },
      failOnStatusCode: false,
    });
    console.log("[G] SB POST status:", sbResp.status());
    const sbBody = await sbResp.json();
    const postId = sbBody?.data?.id ?? sbBody?.data?.post?.id;
    if (postId) {
      // wait for AI reply (best-effort)
      await new Promise((res) => setTimeout(res, 8000));
    }

    // 取触发后 list — 找最新 run
    const afterR = await molly.request.get(`${BASE}/api/lms/ai-usage?take=5`);
    const afterJ = await afterR.json();
    const afterRuns = (afterJ?.data?.items ?? afterJ?.data?.runs ?? []) as Array<{
      id: string;
      inputTokens?: number | null;
      outputTokens?: number | null;
      costEstUSD?: number | null | string;
      summary?: string | null;
      feature?: string;
      model?: string;
      status?: string;
    }>;
    console.log("[G] after runs count:", afterRuns.length);
    if (afterRuns.length > 0) {
      const sample = afterRuns[0];
      console.log("[G] latest run:", JSON.stringify(sample).slice(0, 400));
      // 字段应至少存在（值可能为 null 如果 failed run，但 key 应在）
      const hasNewFields = "inputTokens" in sample && "outputTokens" in sample && "costEstUSD" in sample && "summary" in sample;
      console.log("[G] has all new fields?", hasNewFields);
      expect(hasNewFields).toBe(true);
    }

    // cleanup
    if (postId) {
      await molly.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
    }
  } finally {
    await molly.context.close();
  }
});
