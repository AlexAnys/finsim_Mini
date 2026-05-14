import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

const BASE = "http://localhost:3000";

/**
 * Each user gets its own browser context (separate cookie jar) — avoids NextAuth
 * session race conditions from clearCookies + rapid re-login pattern.
 */
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
      .waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), {
        timeout: 25_000,
      })
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

const MOLLY_TASK_NO_INSTANCES = "e07a8ba8-6ee1-4d57-836b-a4847296f376";
const ALEX_GRADED_SUB = "ce7f935d-5ed0-4af0-9aeb-53a527de372c";

test.describe("Unit 5b A: Study Buddy 软删", () => {
  test("A1: 学生 alex hide 自己的 post → 200 + list 不返回 hidden", async ({
    browser,
  }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    try {
      const createRes = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
        data: {
          taskId: MOLLY_TASK_NO_INSTANCES,
          title: `QA-Unit5b-A1-${Date.now()}`,
          question: "请帮我解释复利的计算公式",
          mode: "direct",
          anonymous: false,
        },
      });
      const createJson = await createRes.json();
      expect(createJson.success).toBe(true);
      const postId = createJson.data.id as string;

      const delRes = await alex.request.delete(
        `${BASE}/api/study-buddy/posts/${postId}`,
      );
      const delJson = await delRes.json();
      console.log("alex hide own:", JSON.stringify(delJson));
      expect(delRes.status()).toBe(200);
      expect(delJson.success).toBe(true);

      const listRes = await alex.request.get(
        `${BASE}/api/study-buddy/posts?taskId=${MOLLY_TASK_NO_INSTANCES}`,
      );
      const listJson = await listRes.json();
      expect(listJson.success).toBe(true);
      const ids = (listJson.data as Array<{ id: string }>).map((p) => p.id);
      expect(ids).not.toContain(postId);
    } finally {
      await alex.context.close();
    }
  });

  test("A2: 学生 belle hide alex 的 post → 403 FORBIDDEN", async ({ browser }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    const belle = await makeAuthedContext(browser, "belle@qq.com", "11");
    try {
      const createRes = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
        data: {
          taskId: MOLLY_TASK_NO_INSTANCES,
          title: `QA-Unit5b-A2-${Date.now()}`,
          question: "测试问题",
          mode: "direct",
          anonymous: false,
        },
      });
      const createJson = await createRes.json();
      expect(createJson.success).toBe(true);
      const postId = createJson.data.id as string;

      const res = await belle.request.delete(
        `${BASE}/api/study-buddy/posts/${postId}`,
      );
      const json = await res.json();
      console.log("belle hide alex post:", JSON.stringify(json));
      expect(json.success).toBe(false);
      expect(json.error?.code).toBe("FORBIDDEN");

      await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
    } finally {
      await alex.context.close();
      await belle.context.close();
    }
  });

  test("A3: 老师 molly hide alex 在 molly 任务下的 post → 200", async ({
    browser,
  }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const createRes = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
        data: {
          taskId: MOLLY_TASK_NO_INSTANCES,
          title: `QA-Unit5b-A3-${Date.now()}`,
          question: "测试问题 A3",
          mode: "direct",
          anonymous: false,
        },
      });
      const postId = (await createRes.json()).data.id as string;

      const delRes = await molly.request.delete(
        `${BASE}/api/study-buddy/posts/${postId}`,
      );
      const delJson = await delRes.json();
      console.log("molly hide alex post:", JSON.stringify(delJson));
      expect(delJson.success).toBe(true);
    } finally {
      await alex.context.close();
      await molly.context.close();
    }
  });

  test("A4: hide 不存在的 post → 404", async ({ browser }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    try {
      const res = await alex.request.delete(
        `${BASE}/api/study-buddy/posts/ffffffff-ffff-4fff-8fff-ffffffffffff`,
      );
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error?.code).toBe("NOT_FOUND");
    } finally {
      await alex.context.close();
    }
  });

  test("A5: idempotent — hide 已 hidden 的 post → 200", async ({ browser }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    try {
      const createRes = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
        data: {
          taskId: MOLLY_TASK_NO_INSTANCES,
          title: `QA-Unit5b-A5-${Date.now()}`,
          question: "幂等测试",
          mode: "direct",
          anonymous: false,
        },
      });
      const postId = (await createRes.json()).data.id as string;
      const r1 = await alex.request.delete(
        `${BASE}/api/study-buddy/posts/${postId}`,
      );
      expect((await r1.json()).success).toBe(true);
      const r2 = await alex.request.delete(
        `${BASE}/api/study-buddy/posts/${postId}`,
      );
      expect((await r2.json()).success).toBe(true);
    } finally {
      await alex.context.close();
    }
  });
});

test.describe("Unit 5b B: Submission 撤销批改", () => {
  test("B1: 老师 ungrade graded → 200 + status 回 submitted + 字段清空", async ({
    browser,
  }) => {
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const beforeRes = await molly.request.get(
        `${BASE}/api/submissions/${ALEX_GRADED_SUB}`,
      );
      const beforeJson = await beforeRes.json();
      const beforeStatus = beforeJson.data.status as string;
      const beforeScore = beforeJson.data.score;
      console.log("baseline:", { status: beforeStatus, score: beforeScore });
      expect(beforeStatus).toBe("graded");

      const res = await molly.request.post(
        `${BASE}/api/submissions/${ALEX_GRADED_SUB}/ungrade`,
      );
      const json = await res.json();
      console.log("ungrade response:", JSON.stringify(json));
      expect(res.status()).toBe(200);
      expect(json.success).toBe(true);

      const afterRes = await molly.request.get(
        `${BASE}/api/submissions/${ALEX_GRADED_SUB}`,
      );
      const afterJson = await afterRes.json();
      expect(afterJson.data.status).toBe("submitted");
      expect(afterJson.data.score).toBeNull();
      expect(afterJson.data.gradedAt).toBeNull();
      expect(afterJson.data.releasedAt).toBeNull();

      // restore
      const restoreRes = await molly.request.post(
        `${BASE}/api/submissions/${ALEX_GRADED_SUB}/grade`,
        {
          data: {
            score: Number(beforeScore) || 0,
            maxScore: 100,
          },
        },
      );
      expect((await restoreRes.json()).success).toBe(true);
    } finally {
      await molly.context.close();
    }
  });

  test("B2: ungrade non-graded → 400 SUBMISSION_NOT_GRADED_YET", async ({
    browser,
  }) => {
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const res1 = await molly.request.post(
        `${BASE}/api/submissions/${ALEX_GRADED_SUB}/ungrade`,
      );
      const json1 = await res1.json();
      console.log("first ungrade:", JSON.stringify(json1));
      expect(json1.success).toBe(true);

      const res2 = await molly.request.post(
        `${BASE}/api/submissions/${ALEX_GRADED_SUB}/ungrade`,
      );
      const json2 = await res2.json();
      console.log("second ungrade:", JSON.stringify(json2));
      expect(res2.status()).toBe(400);
      expect(json2.success).toBe(false);
      expect(json2.error?.code).toBe("SUBMISSION_NOT_GRADED_YET");

      await molly.request.post(
        `${BASE}/api/submissions/${ALEX_GRADED_SUB}/grade`,
        { data: { score: 0, maxScore: 100 } },
      );
    } finally {
      await molly.context.close();
    }
  });

  test("B3: ungrade 不存在的 submission → NOT_FOUND", async ({ browser }) => {
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const res = await molly.request.post(
        `${BASE}/api/submissions/ffffffff-ffff-4fff-8fff-ffffffffffff/ungrade`,
      );
      const json = await res.json();
      console.log("ungrade non-existent:", JSON.stringify(json));
      expect(json.success).toBe(false);
      expect(["NOT_FOUND", "FORBIDDEN"]).toContain(json.error?.code);
    } finally {
      await molly.context.close();
    }
  });
});
