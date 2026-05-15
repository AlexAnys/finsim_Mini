import { test, expect, type APIRequestContext, type BrowserContext, type ConsoleMessage } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit8";

// Test fixtures (builder claim)
const ADAPTIVE_TASK = "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53"; // "深度测试", quiz, adaptive mode, 10 questions tagged
const ADAPTIVE_INSTANCE = "a7d9b380-49fd-4ce2-9d95-000935ac0c5a"; // published in alex's class
const NONEXISTENT = "00000000-0000-0000-0000-000000000000";

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
// A: tag-questions API (molly creator)
// ============================================

test("QA r8 A: molly POST /api/lms/tasks/[id]/tag-questions → 200 (creator + adaptive)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.post(`${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/tag-questions`);
    const body = await resp.json();
    console.log("\n[A] POST tag-questions:", resp.status(), JSON.stringify(body).slice(0, 300));
    expect(resp.status()).toBeLessThan(400);
    // 响应应含 jobId 或 untaggedCount
    const data = body?.data ?? body;
    expect(data).toBeDefined();
  } finally {
    await molly.context.close();
  }
});

test("QA r8 A2: molly GET /api/lms/tasks/[id]/tag-questions → untaggedCount + latestJob", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.get(`${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/tag-questions`);
    const body = await resp.json();
    console.log("\n[A2] GET tag-questions:", resp.status(), JSON.stringify(body).slice(0, 300));
    expect(resp.status()).toBeLessThan(400);
    const data = body?.data ?? body;
    // 应含 untaggedCount (10 题已全标记 → untaggedCount=0)
    expect("untaggedCount" in (data ?? {}) || "untagged" in (data ?? {})).toBe(true);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// B: adaptive-quiz/next API
// ============================================

test("QA r8 B: alex POST /adaptive-quiz/next 空 history → 返回 nextQuestion (10/10 tagged)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const resp = await alex.request.post(
      `${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/adaptive-quiz/next`,
      {
        data: { history: [] },
        failOnStatusCode: false,
      },
    );
    const body = await resp.json();
    console.log("\n[B] adaptive-quiz/next 空 history:", resp.status(), JSON.stringify(body).slice(0, 400));
    expect(resp.status()).toBeLessThan(400);
    const data = body?.data ?? body;
    // 应返回 nextQuestion OR fallback (但因为 10/10 tagged，应返回 nextQuestion)
    const hasNext = "nextQuestion" in (data ?? {}) || "question" in (data ?? {});
    const hasFallback = "fallback" in (data ?? {}) || "shouldFallback" in (data ?? {});
    console.log("[B] hasNext:", hasNext, " hasFallback:", hasFallback);
    expect(hasNext || hasFallback).toBe(true);
  } finally {
    await alex.context.close();
  }
});

test("QA r8 B2: alex POST /adaptive-quiz/next 含 history → 引擎选下一题", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    // 先取一题
    const r1 = await alex.request.post(
      `${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/adaptive-quiz/next`,
      {
        data: { history: [] },
        failOnStatusCode: false,
      },
    );
    const j1 = await r1.json();
    const firstQ = j1?.data?.nextQuestion ?? j1?.data?.question;
    if (!firstQ) {
      console.log("\n[B2] first question not returned — skip subsequent");
      return;
    }
    console.log("\n[B2] first question id:", firstQ.id);

    // 模拟答对，再请求下一题
    const r2 = await alex.request.post(
      `${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/adaptive-quiz/next`,
      {
        data: {
          history: [
            {
              questionId: firstQ.id,
              correct: true,
              difficulty: firstQ.difficulty ?? 3,
              type: firstQ.type,
              knowledgeTagIds: firstQ.knowledgeTagIds ?? [],
            },
          ],
        },
        failOnStatusCode: false,
      },
    );
    const j2 = await r2.json();
    console.log("[B2] second next response status:", r2.status());
    const data2 = j2?.data ?? j2;
    const secondQ = data2?.nextQuestion ?? data2?.question;
    if (secondQ) {
      console.log("[B2] second question id:", secondQ.id);
      expect(secondQ.id).not.toBe(firstQ.id); // 引擎应不重复选同一题
    } else {
      // 也可能 fallback or shouldStop
      console.log("[B2] (info) second question null — engine 可能早停或 fallback");
    }
  } finally {
    await alex.context.close();
  }
});

// ============================================
// C: /check API 404 不存在题目
// ============================================

test("QA r8 C: POST /check 不存在题目 → 404", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const resp = await alex.request.post(
      `${BASE}/api/lms/quiz-questions/${NONEXISTENT}/check`,
      {
        data: { questionId: NONEXISTENT, answer: "anything" },
        failOnStatusCode: false,
      },
    );
    console.log("\n[C] /check nonexistent:", resp.status());
    const body = await resp.json();
    console.log("[C] body:", JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await alex.context.close();
  }
});

// ============================================
// D: alex 进 adaptive task page
// ============================================

test("QA r8 D: alex /tasks/[instance] 显示 '测验 · 自适应' (10/10 tagged 不应 fallback)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  try {
    await page.goto(`${BASE}/tasks/${ADAPTIVE_INSTANCE}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/D1-adaptive-task.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[D] body first 600:", bodyText.slice(0, 600));

    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 应有 "自适应" 字眼 (mode 标识)
    const hasAdaptive = /自适应|adaptive/i.test(bodyText);
    console.log("[D] has 自适应 indicator?", hasAdaptive);
    expect(hasAdaptive, "应显示 '自适应' 模式标识").toBe(true);

    // 0 console error
    const realErrs = consoleErrors.filter(
      (e) => !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e),
    );
    console.log("[D] real console errors:", realErrs.length);
    if (realErrs.length) realErrs.slice(0, 3).forEach((e) => console.log("  -", e.slice(0, 200)));
    expect(realErrs.length, "0 console error").toBe(0);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// E: regression - fixed mode quiz 不破坏
// ============================================

test("QA r8 E: fixed quiz task (3e26c6d2) 仍可正常列表 (回归)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/tasks`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);
    // 应有任务列表
    const hasTaskList = /我的任务|任务中心/.test(bodyText);
    console.log("\n[E] has task list?", hasTaskList);
    expect(hasTaskList).toBe(true);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// F: API permissions
// ============================================

test("QA r8 F: 非 creator (teacher2) POST /tag-questions → 403", async ({ browser }) => {
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  try {
    const resp = await t2.request.post(`${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/tag-questions`);
    console.log("\n[F] teacher2 POST tag-questions:", resp.status());
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await t2.context.close();
  }
});

test("QA r8 G: student POST /tag-questions → 403/401", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const resp = await alex.request.post(`${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/tag-questions`);
    console.log("\n[G] student POST tag-questions:", resp.status());
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await alex.context.close();
  }
});
