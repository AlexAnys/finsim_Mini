import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";

const MOLLY_TASK = "e07a8ba8-6ee1-4d57-836b-a4847296f376"; // PDF导入测验, published instance in alex's class
const ALEX_GRADED_SUB = "ce7f935d-5ed0-4af0-9aeb-53a527de372c";
const NONEXISTENT = "00000000-0000-0000-0000-000000000000";

// Borrowed from builder's e2e: robust 20× session probe
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

async function createSBPost(
  req: APIRequestContext,
  taskId: string,
  suffix: string,
): Promise<{ id: string }> {
  const resp = await req.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskId,
      title: `QA-Unit5b-${suffix}-${Date.now()}`,
      question: "QA test question",
      mode: "direct",
      anonymous: false,
      isPreview: false,
    },
    failOnStatusCode: false,
  });
  const body = await resp.json();
  if (resp.status() >= 400) {
    console.log("createSBPost failed:", resp.status(), JSON.stringify(body).slice(0, 400));
  }
  return { id: body?.data?.id ?? body?.data?.post?.id };
}

test.setTimeout(180_000);

// ============================================
// SB DELETE / HIDE TESTS
// ============================================

test("QA r5b A: alex hide 自己的 SB post → 200 + list 不返回", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const created = await createSBPost(alex.request, MOLLY_TASK, "A-alex-own");
    console.log("\n[A] created post id:", created.id);
    expect(created.id).toMatch(/[0-9a-f-]{36}/);

    const hideResp = await alex.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
    console.log("[A] hide status:", hideResp.status());
    expect(hideResp.status()).toBeLessThan(400);

    const listResp = await alex.request.get(`${BASE}/api/study-buddy/posts?taskId=${MOLLY_TASK}`);
    const listJson = await listResp.json();
    const posts = (listJson?.data?.posts ?? listJson?.data ?? []) as Array<{ id: string }>;
    const stillVisible = posts.find((p) => p.id === created.id);
    console.log("[A] post still in list?", !!stillVisible);
    expect(stillVisible).toBeUndefined();
  } finally {
    await alex.context.close();
  }
});

test("QA r5b B: belle hide alex 的 post → 403 FORBIDDEN", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const belle = await makeAuthedContext(browser, "belle@qq.com", "11");
  try {
    const created = await createSBPost(alex.request, MOLLY_TASK, "B-cross-student");
    console.log("\n[B] alex created post:", created.id);
    expect(created.id).toMatch(/[0-9a-f-]{36}/);

    const hideResp = await belle.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
    const body = await hideResp.json();
    console.log("[B] belle hide result:", hideResp.status(), JSON.stringify(body).slice(0, 200));
    expect(hideResp.status()).toBe(403);
    expect(String(body?.error?.code)).toMatch(/FORBIDDEN/);

    await alex.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
  } finally {
    await belle.context.close();
    await alex.context.close();
  }
});

test("QA r5b C: molly hide alex 的 post (course owner) → 200", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const created = await createSBPost(alex.request, MOLLY_TASK, "C-teacher-hide");
    console.log("\n[C] alex created post:", created.id);
    expect(created.id).toMatch(/[0-9a-f-]{36}/);

    const hideResp = await molly.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
    console.log("[C] molly hide result:", hideResp.status());
    expect(hideResp.status()).toBeLessThan(400);

    const listResp = await alex.request.get(`${BASE}/api/study-buddy/posts?taskId=${MOLLY_TASK}`);
    const listJson = await listResp.json();
    const posts = (listJson?.data?.posts ?? listJson?.data ?? []) as Array<{ id: string }>;
    expect(posts.find((p) => p.id === created.id)).toBeUndefined();
  } finally {
    await molly.context.close();
    await alex.context.close();
  }
});

test("QA r5b D: teacher2 hide molly 课的 post (cross-teacher) → 403 FORBIDDEN", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  try {
    const created = await createSBPost(alex.request, MOLLY_TASK, "D-cross-teacher");
    expect(created.id).toMatch(/[0-9a-f-]{36}/);

    const hideResp = await t2.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
    const body = await hideResp.json();
    console.log("\n[D] teacher2 hide result:", hideResp.status(), JSON.stringify(body).slice(0, 200));
    expect(hideResp.status()).toBe(403);
    expect(String(body?.error?.code)).toMatch(/FORBIDDEN/);

    await alex.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
  } finally {
    await t2.context.close();
    await alex.context.close();
  }
});

test("QA r5b E: hide 不存在的 post → 404 NOT_FOUND + 中文消息", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const resp = await alex.request.delete(`${BASE}/api/study-buddy/posts/${NONEXISTENT}`);
    const body = await resp.json();
    console.log("\n[E] hide nonexistent:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(/NOT_FOUND/.test(String(body?.error?.code))).toBe(true);
    expect(String(body?.error?.message)).toMatch(/[一-鿿]/);
  } finally {
    await alex.context.close();
  }
});

test("QA r5b F: idempotent — 重复 hide 同一 post → 不报错", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const created = await createSBPost(alex.request, MOLLY_TASK, "F-idempotent");
    expect(created.id).toMatch(/[0-9a-f-]{36}/);

    const h1 = await alex.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
    const h2 = await alex.request.delete(`${BASE}/api/study-buddy/posts/${created.id}`);
    console.log("\n[F] hide twice:", h1.status(), h2.status());
    expect(h1.status()).toBeLessThan(400);
    expect(h2.status()).toBeLessThan(400);
  } finally {
    await alex.context.close();
  }
});

// ============================================
// SUBMISSION UNGRADE TESTS
// ============================================

test("QA r5b G: molly ungrade alex's graded sub → 200 + ungraded=true", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.post(`${BASE}/api/submissions/${ALEX_GRADED_SUB}/ungrade`);
    console.log("\n[G] ungrade status:", resp.status());
    const body = await resp.json();
    console.log("[G] body:", JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeLessThan(400);
    expect(body?.success).toBe(true);
    expect(body?.data?.ungraded).toBe(true);
  } finally {
    await molly.context.close();
  }
});

test("QA r5b H: ungrade 已 ungraded 的 sub → 400 SUBMISSION_NOT_GRADED_YET + 中文", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.post(`${BASE}/api/submissions/${ALEX_GRADED_SUB}/ungrade`);
    const body = await resp.json();
    console.log("\n[H] ungrade twice:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(String(body?.error?.code)).toMatch(/SUBMISSION_NOT_GRADED_YET|NOT_GRADED/);
    expect(String(body?.error?.message)).toMatch(/[一-鿿]/);
  } finally {
    await molly.context.close();
  }
});

test("QA r5b I: ungrade 不存在的 sub → 404 NOT_FOUND", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.post(`${BASE}/api/submissions/${NONEXISTENT}/ungrade`);
    const body = await resp.json();
    console.log("\n[I] ungrade nonexistent:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await molly.context.close();
  }
});

test("QA r5b J: teacher2 (non-owner) ungrade → 403/4xx (权限隔离)", async ({ browser }) => {
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  try {
    const resp = await t2.request.post(`${BASE}/api/submissions/${ALEX_GRADED_SUB}/ungrade`);
    const body = await resp.json();
    console.log("\n[J] teacher2 ungrade:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(String(body?.error?.code)).toMatch(/FORBIDDEN|UNAUTHORIZED|NOT_FOUND/);
  } finally {
    await t2.context.close();
  }
});

test("QA r5b K: student alex 无权 ungrade → 4xx", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const resp = await alex.request.post(`${BASE}/api/submissions/${ALEX_GRADED_SUB}/ungrade`);
    const body = await resp.json();
    console.log("\n[K] alex ungrade:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await alex.context.close();
  }
});
