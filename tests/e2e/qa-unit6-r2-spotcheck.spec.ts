import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit6-r2";

const TEACHER1_COURSE = "e6fc049c-756f-4442-86da-35a6cdbadd6e";
const MOLLY_TASK_PUBLISHED = "e07a8ba8-6ee1-4d57-836b-a4847296f376";

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

test.setTimeout(120_000);

// ============================================
// CRITICAL: Finding A 修复验证（创建-列表往返）
// ============================================

test("QA r6 r2 A: alex 创建 free-form (null+null) → 进 /study-buddy 列表 200 + DOM 无 crash", async ({
  browser,
}) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();

  // capture console errors
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  let postId: string | undefined;
  try {
    // 1. POST 全 null context 自由问
    const tempTitle = `QA-r6r2-A-${Date.now()}`;
    const r1 = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        title: tempTitle,
        question: "什么是个人理财？",
        mode: "direct",
        anonymous: false,
        isPreview: false,
      },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    expect(r1.status()).toBeLessThan(400);
    postId = b1?.data?.id ?? b1?.data?.post?.id;
    expect(String(postId)).toMatch(/[0-9a-f-]{36}/);
    console.log("\n[A] post created:", postId, "title:", tempTitle);

    // 2. 进 /study-buddy 列表（关键 — r1 这里崩）
    await page.goto(`${BASE}/study-buddy`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/A1-list-after-freeform.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("[A] page body first 500:", bodyText.slice(0, 500));

    // 应不含 500 错误页面字眼
    const hasServerError = /服务器开小差|服务暂时无法响应|500/.test(bodyText);
    console.log("[A] page has 500 error?", hasServerError);
    expect(hasServerError, "页面应正常加载,不应崩").toBe(false);

    // 应含新创建的 post title
    const hasTitle = bodyText.includes(tempTitle);
    console.log("[A] page contains new post title?", hasTitle);
    expect(hasTitle, "新创建的 free-form post 应出现在列表").toBe(true);

    // console 不应有 null-deref 错误
    const nullDerefs = consoleErrors.filter(
      (e) =>
        /Cannot read properties of null.*length/i.test(e) ||
        /courseColorForId/i.test(e),
    );
    console.log("[A] null deref errors:", nullDerefs.length);
    expect(nullDerefs.length, "0 null deref console error").toBe(0);
  } finally {
    // cleanup
    if (postId) {
      await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
    }
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// CRITICAL: ?openNew=true 重新验证 (r1 的 I 失败)
// ============================================

test("QA r6 r2 B: alex /study-buddy?openNew=true → dialog 自动打开 + 通用模式 (r1 I 复测)", async ({
  browser,
}) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/study-buddy?openNew=true`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/B1-openNew.png`, fullPage: true });

    // 应不是 500
    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应不是 500").toBe(false);

    // dialog 应可见
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    expect(await dialog.isVisible()).toBe(true);

    // dialog 含 segmented "通用提问 / 任务相关"
    const dialogText = (await dialog.textContent()) ?? "";
    console.log("\n[B] dialog text first 300:", dialogText.slice(0, 300));
    expect(dialogText).toMatch(/通用提问/);
    expect(dialogText).toMatch(/任务相关/);

    // 通用提问 应是 aria-pressed=true (active 默认)
    const generalBtn = page.locator('button[aria-pressed="true"]', { hasText: /通用提问/ });
    const generalCount = await generalBtn.count();
    console.log("[B] 通用提问 active count:", generalCount);
    expect(generalCount, "通用提问 应是 aria-pressed=true 默认").toBeGreaterThan(0);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// R1 spot-check 1: 任务相关 POST 仍正常 (regression)
// ============================================

test("QA r6 r2 C: task-bound POST 仍正常 (spot-check r1 J)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const r1 = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        taskId: MOLLY_TASK_PUBLISHED,
        courseId: TEACHER1_COURSE,
        title: `QA-r6r2-C-task-${Date.now()}`,
        question: "regression check",
        mode: "direct",
        anonymous: false,
        isPreview: false,
      },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    console.log("\n[C] task-bound POST:", r1.status());
    expect(r1.status()).toBeLessThan(400);
    const postId = b1?.data?.id ?? b1?.data?.post?.id;
    expect(String(postId)).toMatch(/[0-9a-f-]{36}/);

    await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  } finally {
    await alex.context.close();
  }
});

// ============================================
// R1 spot-check 2: 老师 /teacher/study-buddy 仍正常
// ============================================

test("QA r6 r2 D: molly /teacher/study-buddy 仍正常 (spot-check r1 E)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/study-buddy`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应不是 500").toBe(false);
    expect(/未答疑|已回复|全部/.test(bodyText)).toBe(true);

    // API endpoint 仍工作
    const apiResp = await molly.request.get(`${BASE}/api/teacher/study-buddy/posts`);
    expect(apiResp.status()).toBeLessThan(400);
  } finally {
    await page.close();
    await molly.context.close();
  }
});
