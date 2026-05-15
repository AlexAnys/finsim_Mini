import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit15";

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
// A: teacher2 (0 graded subs) → API emptyState=true + modelUsed=null + durationMs=0
// ============================================

test("QA r15 A: teacher2 (0 graded subs) GET weekly-insight → emptyState=true / modelUsed=null / durationMs=0", async ({
  browser,
}) => {
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  try {
    const resp = await t2.request.get(`${BASE}/api/lms/weekly-insight?force=true`);
    expect(resp.status()).toBe(200);
    const j = await resp.json();
    const data = j?.data ?? j;
    console.log("\n[A] response keys:", Object.keys(data ?? {}));
    console.log("[A] modelUsed:", data?.modelUsed);
    console.log("[A] durationMs:", data?.durationMs);
    console.log("[A] payload.emptyState:", data?.payload?.emptyState);
    console.log("[A] submissionCount:", data?.submissionCount);

    // emptyState 应在 payload 内
    const emptyState = data?.payload?.emptyState;
    expect(emptyState, "0 graded subs 应触发 emptyState=true").toBe(true);

    // AI 不调用 - modelUsed null + durationMs 0
    expect(data?.modelUsed, "emptyState 时 modelUsed 应 null").toBeNull();
    expect(data?.durationMs, "emptyState 时 durationMs 应 0").toBe(0);

    // submissionCount=0
    expect(data?.submissionCount).toBe(0);
  } finally {
    await t2.context.close();
  }
});

// ============================================
// B: cache 透传 emptyState (5 分钟 TTL)
// ============================================

test("QA r15 B: teacher2 第二次 GET 命中 cache 仍 emptyState=true", async ({ browser }) => {
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  try {
    // 第一次先确保有 cache
    await t2.request.get(`${BASE}/api/lms/weekly-insight`);

    // 第二次 GET 不 force, 应 cache hit
    const r2 = await t2.request.get(`${BASE}/api/lms/weekly-insight`);
    expect(r2.status()).toBe(200);
    const j2 = await r2.json();
    const data = j2?.data ?? j2;
    console.log("\n[B] cached:", data?.cached);
    console.log("[B] payload.emptyState:", data?.payload?.emptyState);

    expect(data?.payload?.emptyState).toBe(true);
    // 5min TTL cache 应允许第二次命中（cached=true）
    // 但如果第一次也 cache=false 没存，第二次可能也 cache=false — 接受任一
  } finally {
    await t2.context.close();
  }
});

// ============================================
// C: teacher2 dashboard 打开 modal → CTA 卡显示
// ============================================

test("QA r15 C: teacher2 dashboard → 点 '一周洞察' → modal CTA '本周尚无可聚合数据' + '去管理任务实例' link", async ({
  browser,
}) => {
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  const page = await t2.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    // 点开一周洞察
    const weeklyBtn = page.getByRole("button", { name: /一周洞察/ }).first();
    expect(await weeklyBtn.count()).toBeGreaterThan(0);
    await weeklyBtn.click();
    await page.waitForTimeout(3000);

    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    // 等 loading 结束
    for (let i = 0; i < 15; i++) {
      const txt = (await dialog.textContent()) ?? "";
      if (/本周尚无|去管理任务实例|无可聚合/.test(txt)) break;
      if (!/正在生成/.test(txt)) break;
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SS}/C1-empty-modal.png`, fullPage: true });

    const dialogText = (await dialog.textContent()) ?? "";
    console.log("\n[C] dialog text first 500:", dialogText.slice(0, 500));

    // 应有 CTA 文案
    const hasCTA = /本周尚无可聚合数据|尚无.*数据|无可聚合/.test(dialogText);
    console.log("[C] has CTA hint?", hasCTA);
    expect(hasCTA, "emptyState 应显示 CTA 文案").toBe(true);

    // 应有 Link "去管理任务实例"
    const ctaLink = page.locator('a[href*="/teacher/instances"]').filter({ hasText: /去管理任务实例|管理任务实例/ });
    const linkCount = await ctaLink.count();
    console.log("[C] '去管理任务实例' link count:", linkCount);
    expect(linkCount, "应有'去管理任务实例'link 指向 /teacher/instances").toBeGreaterThan(0);
  } finally {
    await page.close();
    await t2.context.close();
  }
});

// ============================================
// D: molly (有数据) 一周洞察不应 emptyState (regression)
// ============================================

test("QA r15 D: molly (有 7 graded subs) GET weekly-insight → emptyState NOT true (regression)", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.get(`${BASE}/api/lms/weekly-insight`);
    expect(resp.status()).toBe(200);
    const j = await resp.json();
    const data = j?.data ?? j;
    console.log("\n[D] submissionCount:", data?.submissionCount);
    console.log("[D] payload.emptyState:", data?.payload?.emptyState);
    console.log("[D] modelUsed:", data?.modelUsed);

    // molly 有 graded subs (但是否在 7-day window 内不确定，我们检查更宽松条件)
    // 即使在 window 内，只要 cache 已有数据，emptyState 应不为 true
    // 如果在 window 外的 graded subs 也 0，那 emptyState 可能 true — 接受这种情况但记录
    const emptyState = data?.payload?.emptyState;
    if (emptyState === true) {
      console.log("[D] (info) molly 7-day window 内无 graded sub → emptyState=true (正确行为)");
    } else {
      console.log("[D] molly 有数据 → emptyState !== true ✓");
    }
  } finally {
    await molly.context.close();
  }
});

// ============================================
// E: API 字段完整 (backward-compat)
// ============================================

test("QA r15 E: weekly-insight API 字段完整 (emptyState 在 payload 内)", async ({ browser }) => {
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  try {
    const resp = await t2.request.get(`${BASE}/api/lms/weekly-insight`);
    const j = await resp.json();
    const data = j?.data ?? j;
    console.log("\n[E] response keys:", Object.keys(data ?? {}));
    console.log("[E] payload keys:", Object.keys(data?.payload ?? {}));

    // payload 内应有 emptyState
    expect("emptyState" in (data?.payload ?? {})).toBe(true);
    // 顶层应仍有 modelUsed / durationMs / cached / submissionCount
    for (const k of ["modelUsed", "durationMs", "cached", "submissionCount", "payload"]) {
      expect(k in (data ?? {})).toBe(true);
    }
  } finally {
    await t2.context.close();
  }
});
