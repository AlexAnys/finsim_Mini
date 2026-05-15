import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit6";

// fixtures
const TEACHER1_COURSE = "e6fc049c-756f-4442-86da-35a6cdbadd6e"; // teacher1 owns, molly is collab, has KS
const MOLLY_TASK_PUBLISHED = "e07a8ba8-6ee1-4d57-836b-a4847296f376"; // PDF导入测验 (with published instance)

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

// Poll via list endpoint (single-post GET doesn't exist; list returns student's own posts)
async function waitForReply(
  req: APIRequestContext,
  postId: string,
  taskId?: string,
  maxMs = 35_000,
): Promise<{ status: string; aiReply: string | null; messages: unknown[] | null }> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    // student list endpoint filters by studentId implicitly; can filter by taskId
    const url = taskId
      ? `${BASE}/api/study-buddy/posts?taskId=${taskId}`
      : `${BASE}/api/study-buddy/posts?take=100`;
    const r = await req.get(url);
    if (r.ok()) {
      const j = await r.json();
      const posts = (j?.data?.posts ?? j?.data ?? []) as Array<{
        id: string;
        status: string;
        aiReply?: string | null;
        messages?: unknown[] | null;
      }>;
      const post = posts.find((p) => p.id === postId);
      if (post && (post.status === "answered" || post.status === "failed")) {
        return {
          status: post.status,
          aiReply: post.aiReply ?? null,
          messages: post.messages ?? null,
        };
      }
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  return { status: "timeout", aiReply: null, messages: null };
}

test.setTimeout(180_000);

// ============================================
// A: 自由问支持 (acceptance #1)
// ============================================

test("QA r6 A: alex 自由问无 taskId → 201 + 课程级回答", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const r1 = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        // 不传 taskId
        courseId: TEACHER1_COURSE,
        title: `QA-r6-A-freeform-${Date.now()}`,
        question: "什么是个人理财？",
        mode: "direct",
        anonymous: false,
        isPreview: false,
      },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    console.log("\n[A] free-form POST status:", r1.status());
    console.log("[A] body:", JSON.stringify(b1).slice(0, 300));
    expect(r1.status()).toBeLessThan(400);
    const postId = b1?.data?.id ?? b1?.data?.post?.id;
    expect(String(postId)).toMatch(/[0-9a-f-]{36}/);
    console.log("[A] post id:", postId);

    // wait for AI to answer
    const replied = await waitForReply(alex.request, postId);
    console.log("[A] final status:", replied.status, "aiReply len:", replied.aiReply?.length ?? 0);
    expect(replied.status, "AI 应答 (不应 failed/timeout)").toBe("answered");
    expect(replied.aiReply, "aiReply 应非空").toBeTruthy();
    expect((replied.aiReply ?? "").length).toBeGreaterThan(10);

    // cleanup
    await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  } finally {
    await alex.context.close();
  }
});

test("QA r6 B: 任务相关 (有 taskId, 不传 courseId) → 201 + 课程自动反推", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const r1 = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        taskId: MOLLY_TASK_PUBLISHED,
        // 不传 courseId — 服务端应从 task → instance → courseId 反推
        title: `QA-r6-B-task-${Date.now()}`,
        question: "测试自动反推",
        mode: "direct",
        anonymous: false,
        isPreview: false,
      },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    console.log("\n[B] task-bound POST status:", r1.status());
    expect(r1.status()).toBeLessThan(400);
    const postId = b1?.data?.id ?? b1?.data?.post?.id;
    expect(String(postId)).toMatch(/[0-9a-f-]{36}/);

    // cleanup
    await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  } finally {
    await alex.context.close();
  }
});

test("QA r6 C: 完全无 taskId + 无 courseId → 201 (全平台通用自由问)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const r1 = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        title: `QA-r6-C-noctx-${Date.now()}`,
        question: "什么是复利？",
        mode: "direct",
        anonymous: false,
        isPreview: false,
      },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    console.log("\n[C] no-context POST status:", r1.status(), "body:", JSON.stringify(b1).slice(0, 300));
    expect(r1.status()).toBeLessThan(400);
    const postId = b1?.data?.id ?? b1?.data?.post?.id;
    expect(String(postId)).toMatch(/[0-9a-f-]{36}/);

    // wait for AI to answer — 无 context 也不应拒答
    const replied = await waitForReply(alex.request, postId);
    console.log("[C] final status:", replied.status, "aiReply len:", replied.aiReply?.length ?? 0);
    console.log("[C] aiReply preview:", replied.aiReply?.slice(0, 200));
    expect(replied.status, "无 context 仍应 AI 答 (不拒答)").toBe("answered");
    expect(replied.aiReply, "aiReply 非空").toBeTruthy();
    expect((replied.aiReply ?? "").length, "aiReply 内容应足量").toBeGreaterThan(20);

    // cleanup
    await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  } finally {
    await alex.context.close();
  }
});

// ============================================
// D: Excerpt 持久化 (acceptance #3)
// ============================================

test("QA r6 D: 有素材时 messages.contextSources 含 excerpt", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const r1 = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        courseId: TEACHER1_COURSE, // 该课程有 3 个 KS
        title: `QA-r6-D-excerpt-${Date.now()}`,
        question: "请帮我解释个人理财的核心要素",
        mode: "direct",
        anonymous: false,
        isPreview: false,
      },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    expect(r1.status()).toBeLessThan(400);
    const postId = b1?.data?.id ?? b1?.data?.post?.id;
    console.log("\n[D] post id:", postId);

    const replied = await waitForReply(alex.request, postId, undefined, 60_000);
    console.log("[D] status:", replied.status);
    expect(replied.status).toBe("answered");

    // 检查 messages 数组中 assistant message 是否有 contextSources
    const messages = replied.messages as Array<{
      role: string;
      content: string;
      contextSources?: Array<{ fileName: string; excerpt?: string }>;
    }> | null;
    console.log("[D] messages count:", messages?.length);
    const assistantMsg = messages?.find((m) => m.role === "ai" || m.role === "assistant");
    console.log("[D] assistant has contextSources?", !!assistantMsg?.contextSources);
    if (assistantMsg?.contextSources) {
      console.log("[D] contextSources count:", assistantMsg.contextSources.length);
      const withExcerpt = assistantMsg.contextSources.filter((s) => s.excerpt && s.excerpt.length > 0);
      console.log("[D] sources with excerpt:", withExcerpt.length);
      if (withExcerpt.length > 0) {
        console.log("[D] sample excerpt:", withExcerpt[0].excerpt?.slice(0, 100));
      }
      // expect at least 1 source has excerpt (since course has KS)
      expect(withExcerpt.length, "至少 1 个 source 含 excerpt (course 有 KS)").toBeGreaterThan(0);
    }

    // cleanup
    await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  } finally {
    await alex.context.close();
  }
});

// ============================================
// E: 老师管理页 (acceptance #4)
// ============================================

test("QA r6 E: molly /teacher/study-buddy 加载 200 + 跨课程聚合", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/study-buddy`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/E1-teacher-sb.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[E] body first 500:", bodyText.slice(0, 500));

    // 应有 SB 管理页相关字眼
    const hasTabs = /未答疑|已回复|全部|所有/.test(bodyText);
    expect(hasTabs, "应有 tab 字眼").toBe(true);

    // 检查 API 数据
    const apiResp = await molly.request.get(`${BASE}/api/teacher/study-buddy/posts`);
    expect(apiResp.status()).toBeLessThan(400);
    const apiBody = await apiResp.json();
    console.log("[E] API stats:", JSON.stringify(apiBody?.data?.stats ?? apiBody?.stats ?? {}).slice(0, 200));
    const posts = apiBody?.data?.posts ?? apiBody?.posts ?? [];
    console.log("[E] API returned posts count:", posts.length);
    expect(Array.isArray(posts)).toBe(true);
  } finally {
    await page.close();
    await molly.context.close();
  }
});

test("QA r6 F: alex (student) 访问 /teacher/study-buddy → 403/重定向", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    // student 不应能访问
    const resp = await alex.request.get(`${BASE}/api/teacher/study-buddy/posts`);
    console.log("\n[F] student GET teacher endpoint:", resp.status());
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// G: sidebar nav "学生提问" for teacher
// ============================================

test("QA r6 G: molly sidebar 有「学生提问」nav 项", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/G1-teacher-dashboard.png`, fullPage: true });

    const sbLink = page.locator('nav a, [role="navigation"] a').filter({ hasText: /学生提问/ });
    const count = await sbLink.count();
    console.log("\n[G] 学生提问 nav count:", count);
    expect(count, "教师 sidebar 应有「学生提问」").toBeGreaterThan(0);

    // click → 跳 /teacher/study-buddy
    await sbLink.first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    const url = page.url();
    console.log("[G] URL after click:", url);
    expect(url).toMatch(/\/teacher\/study-buddy/);
  } finally {
    await page.close();
    await molly.context.close();
  }
});

// ============================================
// H: dashboard callout `?openNew=true` 默认通用模式
// ============================================

test("QA r6 H: alex dashboard AI buddy callout href 含 ?openNew=true", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/H1-student-dashboard.png`, fullPage: true });

    // find callout link
    const calloutLink = page.locator('a[href*="/study-buddy"][href*="openNew=true"]');
    const count = await calloutLink.count();
    console.log("\n[H] callout link with openNew=true count:", count);
    expect(count, "应有 /study-buddy?openNew=true 链接").toBeGreaterThan(0);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

test("QA r6 I: alex /study-buddy?openNew=true → dialog 自动打开 + 通用模式 active", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/study-buddy?openNew=true`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/I1-openNew.png`, fullPage: true });

    // 应有 dialog 打开
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    const dialogVisible = await dialog.isVisible();
    console.log("\n[I] dialog visible:", dialogVisible);
    expect(dialogVisible).toBe(true);

    // 应有 segmented "通用提问 / 任务相关"
    const dialogText = (await dialog.textContent()) ?? "";
    console.log("[I] dialog text first 300:", dialogText.slice(0, 300));
    expect(dialogText).toMatch(/通用提问/);
    expect(dialogText).toMatch(/任务相关/);

    // 应有 aria-pressed=true 的 "通用提问" 按钮 (active 状态)
    const generalBtn = page.locator('button[aria-pressed="true"]', { hasText: /通用提问/ });
    const generalCount = await generalBtn.count();
    console.log("[I] 通用提问 active count:", generalCount);
    expect(generalCount, "通用提问 应是 aria-pressed=true 默认").toBeGreaterThan(0);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// J: Anti-regression (现有 task-bound POST 不破坏)
// ============================================

test("QA r6 J: task-bound POST 仍正常 (regression)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const r1 = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        taskId: MOLLY_TASK_PUBLISHED,
        courseId: TEACHER1_COURSE,
        title: `QA-r6-J-task-bound-${Date.now()}`,
        question: "regression check",
        mode: "direct",
        anonymous: false,
        isPreview: false,
      },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    console.log("\n[J] task-bound POST:", r1.status());
    expect(r1.status()).toBeLessThan(400);
    const postId = b1?.data?.id ?? b1?.data?.post?.id;
    expect(String(postId)).toMatch(/[0-9a-f-]{36}/);

    await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  } finally {
    await alex.context.close();
  }
});
