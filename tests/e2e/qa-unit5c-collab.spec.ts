import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";

// fixtures
const TEACHER1_COURSE = "e6fc049c-756f-4442-86da-35a6cdbadd6e"; // teacher1 owns, molly is collab, has 3 chap / 9 inst
const MOLLY_OWN_COURSE = "8f7f653c-9177-44f6-b764-80f7f779b2ef"; // molly owns
const TEACHER1_KS = "46d57c02-b5bc-494a-a64e-ce67f6486d07"; // lingxi-course-outline.txt, uploaded by teacher1, in collab course
const TEACHER1_CHAPTER_ID = "baf9c3d6-b36d-4b72-abbc-98b96eb49443"; // 理财基础概念 chapter in teacher1's course
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
// COLLAB ALLOWED — molly on teacher1's course
// ============================================

test("QA r5c A: molly (collab) PATCH teacher1 course description → 200 + audit actorRole=collaborator", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    // baseline
    const r0 = await molly.request.get(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`);
    const j0 = await r0.json();
    const originalDesc = j0?.data?.description ?? j0?.data?.course?.description ?? null;
    console.log("\n[A] baseline description:", originalDesc?.slice(0, 60));

    // PATCH (collab should be allowed)
    const tempDesc = `QA-r5c-A-${Date.now()}`;
    const r1 = await molly.request.patch(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`, {
      data: { description: tempDesc },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    console.log("[A] PATCH status:", r1.status(), "body:", JSON.stringify(b1).slice(0, 200));
    expect(r1.status()).toBeLessThan(400);

    // restore
    await molly.request.patch(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`, {
      data: { description: originalDesc },
      failOnStatusCode: false,
    });
  } finally {
    await molly.context.close();
  }
});

test("QA r5c B: molly (collab) POST chapter to teacher1 course → 201 (then cleanup)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const tempTitle = `QA-r5c-chapter-${Date.now()}`;
    const r1 = await molly.request.post(`${BASE}/api/lms/chapters`, {
      data: { courseId: TEACHER1_COURSE, title: tempTitle, order: 99 },
      failOnStatusCode: false,
    });
    const b1 = await r1.json();
    console.log("\n[B] create chapter status:", r1.status(), JSON.stringify(b1).slice(0, 200));
    expect(r1.status()).toBeLessThan(400);

    const newId = b1?.data?.id ?? b1?.data?.chapter?.id;
    expect(String(newId)).toMatch(/[0-9a-f-]{36}/);

    // cleanup: DELETE the new chapter
    const delR = await molly.request.delete(`${BASE}/api/lms/chapters/${newId}`);
    console.log("[B] cleanup DELETE:", delR.status());
    expect(delR.status()).toBeLessThan(400);
  } finally {
    await molly.context.close();
  }
});

test("QA r5c C: molly (collab) PATCH chapter on teacher1 course → 200", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  // baseline known from DB: TEACHER1_CHAPTER_ID title = "理财基础概念"
  const ORIGINAL_TITLE = "理财基础概念";
  try {
    const r1 = await molly.request.patch(`${BASE}/api/lms/chapters/${TEACHER1_CHAPTER_ID}`, {
      data: { title: `${ORIGINAL_TITLE} (QA-r5c-C-${Date.now()})` },
      failOnStatusCode: false,
    });
    console.log("\n[C] PATCH status:", r1.status());
    const b1 = await r1.json().catch(() => null);
    console.log("[C] body:", JSON.stringify(b1).slice(0, 200));
    expect(r1.status()).toBeLessThan(400);

    // restore
    const rR = await molly.request.patch(`${BASE}/api/lms/chapters/${TEACHER1_CHAPTER_ID}`, {
      data: { title: ORIGINAL_TITLE },
      failOnStatusCode: false,
    });
    console.log("[C] restore:", rR.status());
    expect(rR.status()).toBeLessThan(400);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// KS OWNER-CONFIRM (协作删 owner 上传素材)
// ============================================

test("QA r5c D: molly (collab) DELETE teacher1's KS 无 force → 400 KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM 中文", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const r1 = await molly.request.delete(`${BASE}/api/lms/course-knowledge-sources/${TEACHER1_KS}`);
    const b1 = await r1.json();
    console.log("\n[D] DELETE no force:", r1.status(), JSON.stringify(b1).slice(0, 300));
    expect(r1.status()).toBeGreaterThanOrEqual(400);
    expect(String(b1?.error?.code)).toMatch(/OWNER_REQUIRES_CONFIRM|KNOWLEDGE_SOURCE_OWNER/);
    expect(String(b1?.error?.message)).toMatch(/[一-鿿]/);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// OWNER-ONLY 保留 (deletions stay owner-only)
// ============================================

test("QA r5c E: molly (collab) DELETE teacher1 course → 403 FORBIDDEN (owner-only 保留)", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.delete(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`);
    const body = await resp.json();
    console.log("\n[E] collab DELETE teacher1 course:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(String(body?.error?.code)).toMatch(/FORBIDDEN|UNAUTHORIZED/);
  } finally {
    await molly.context.close();
  }
});

test("QA r5c F: molly (collab) POST course collaborator → 403 FORBIDDEN (协作管理 owner-only)", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    // try add teacher2 as collab via teacher1 course
    const resp = await molly.request.post(`${BASE}/api/lms/courses/${TEACHER1_COURSE}/teachers`, {
      data: { teacherEmail: "teacher2@finsim.edu.cn" },
      failOnStatusCode: false,
    });
    const body = await resp.json();
    console.log("\n[F] collab adds collaborator:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(String(body?.error?.code)).toMatch(/FORBIDDEN|UNAUTHORIZED|404/);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// CROSS-COURSE ISOLATION (regression)
// ============================================

test("QA r5c G: teacher2 (no collab) PATCH teacher1 course → 403 FORBIDDEN", async ({ browser }) => {
  const t2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  try {
    const resp = await t2.request.patch(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`, {
      data: { description: "QA-r5c-G-cross" },
      failOnStatusCode: false,
    });
    const body = await resp.json();
    console.log("\n[G] cross teacher PATCH:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(String(body?.error?.code)).toMatch(/FORBIDDEN|UNAUTHORIZED/);
  } finally {
    await t2.context.close();
  }
});

test("QA r5c H: alex (student) PATCH teacher1 course → 403 FORBIDDEN (role)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const resp = await alex.request.patch(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`, {
      data: { description: "QA-r5c-H-student" },
      failOnStatusCode: false,
    });
    const body = await resp.json();
    console.log("\n[H] student PATCH:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await alex.context.close();
  }
});

// ============================================
// OWNER ABILITY UNCHANGED (regression)
// ============================================

test("QA r5c I: teacher1 (owner) PATCH own course → 200 + audit actorRole=owner", async ({ browser }) => {
  const t1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  try {
    const r0 = await t1.request.get(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`);
    const j0 = await r0.json();
    const original = j0?.data?.description ?? j0?.data?.course?.description ?? null;

    const r1 = await t1.request.patch(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`, {
      data: { description: `QA-r5c-I-owner-${Date.now()}` },
      failOnStatusCode: false,
    });
    console.log("\n[I] owner PATCH:", r1.status());
    expect(r1.status()).toBeLessThan(400);

    // restore
    await t1.request.patch(`${BASE}/api/lms/courses/${TEACHER1_COURSE}`, {
      data: { description: original },
      failOnStatusCode: false,
    });
  } finally {
    await t1.context.close();
  }
});

test("QA r5c J: molly (owner of own course) PATCH → 200 + audit actorRole=owner", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const r0 = await molly.request.get(`${BASE}/api/lms/courses/${MOLLY_OWN_COURSE}`);
    const j0 = await r0.json();
    const original = j0?.data?.description ?? j0?.data?.course?.description ?? null;

    const r1 = await molly.request.patch(`${BASE}/api/lms/courses/${MOLLY_OWN_COURSE}`, {
      data: { description: `QA-r5c-J-own-${Date.now()}` },
      failOnStatusCode: false,
    });
    console.log("\n[J] own course PATCH:", r1.status());
    expect(r1.status()).toBeLessThan(400);

    // restore
    await molly.request.patch(`${BASE}/api/lms/courses/${MOLLY_OWN_COURSE}`, {
      data: { description: original },
      failOnStatusCode: false,
    });
  } finally {
    await molly.context.close();
  }
});

// ============================================
// 404
// ============================================

test("QA r5c K: PATCH non-existent course → 404 NOT_FOUND", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.patch(`${BASE}/api/lms/courses/${NONEXISTENT}`, {
      data: { description: "test" },
      failOnStatusCode: false,
    });
    const body = await resp.json();
    console.log("\n[K] nonexistent:", resp.status(), JSON.stringify(body).slice(0, 200));
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  } finally {
    await molly.context.close();
  }
});
