import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit6-verify";

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

const MOLLY_COURSE_NO_INSTANCES = "8f7f653c-9177-44f6-b764-80f7f779b2ef"; // molly own course
const MOLLY_TASK = "e07a8ba8-6ee1-4d57-836b-a4847296f376"; // molly task (no instances)
const TEACHER1_COURSE = "e6fc049c-756f-4442-86da-35a6cdbadd6e"; // molly is collab

test.describe("Unit 6 A: Study Buddy 自由问 + excerpt", () => {
  test("A1: alex POST 自由问无 taskId → 201（schema 已 optional）", async ({
    browser,
  }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    try {
      const res = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
        data: {
          title: `QA-Unit6-A1-free-${Date.now()}`,
          question: "请解释复利的基本概念",
          mode: "direct",
          anonymous: false,
          // 不传 taskId / taskInstanceId / courseId
        },
      });
      const json = await res.json();
      console.log("free-form create:", JSON.stringify(json).slice(0, 200));
      expect(res.status()).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.taskId).toBeNull();
      expect(json.data.courseId).toBeNull();

      // cleanup
      await alex.request.delete(
        `${BASE}/api/study-buddy/posts/${json.data.id}`,
      );
    } finally {
      await alex.context.close();
    }
  });

  test("A2: alex POST 自由问 + 选 molly's course → courseId 写入 → 老师管理页可见", async ({
    browser,
  }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const createRes = await alex.request.post(
        `${BASE}/api/study-buddy/posts`,
        {
          data: {
            title: `QA-Unit6-A2-course-${Date.now()}`,
            question: "什么是个人理财基本要素？",
            mode: "direct",
            anonymous: false,
            courseId: MOLLY_COURSE_NO_INSTANCES,
          },
        },
      );
      const createJson = await createRes.json();
      console.log("free-form with course:", JSON.stringify(createJson).slice(0, 200));
      expect(createJson.success).toBe(true);
      expect(createJson.data.courseId).toBe(MOLLY_COURSE_NO_INSTANCES);
      const postId = createJson.data.id as string;

      // wait for AI reply (5-15s)
      await alex.request.get(`${BASE}/api/study-buddy/posts?taskId=`); // dummy
      for (let i = 0; i < 30; i++) {
        const r = await alex.request.get(
          `${BASE}/api/study-buddy/posts?courseId=${MOLLY_COURSE_NO_INSTANCES}`,
        );
        await r.json();
        await alex.context.newPage().then(async (p) => {
          await p.waitForTimeout(1000);
          await p.close();
        });
        const r2 = await alex.request.get(`${BASE}/api/study-buddy/posts?courseId=`);
        void r2;
        // simpler check: fetch the post directly
        const detailRes = await alex.request.get(`${BASE}/api/study-buddy/posts`);
        const detailJson = await detailRes.json();
        const found = (detailJson.data as Array<{ id: string; status: string }>).find(
          (p) => p.id === postId,
        );
        if (found?.status === "answered" || found?.status === "error") break;
      }

      // 老师 molly 看自己课程的 SB 管理页
      const mgmtRes = await molly.request.get(
        `${BASE}/api/teacher/study-buddy/posts?scope=all`,
      );
      const mgmtJson = await mgmtRes.json();
      console.log("molly mgmt page total:", mgmtJson.data?.stats?.total);
      const visible = (mgmtJson.data?.posts as Array<{ id: string; isFreeForm: boolean }>).some(
        (p) => p.id === postId,
      );
      expect(visible).toBe(true);

      // cleanup
      await alex.request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
    } finally {
      await alex.context.close();
      await molly.context.close();
    }
  });

  test("A3: alex POST 任务相关（既有 flow）→ 201 + courseId 自动反推", async ({
    browser,
  }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    try {
      const res = await alex.request.post(`${BASE}/api/study-buddy/posts`, {
        data: {
          taskId: MOLLY_TASK,
          title: `QA-Unit6-A3-task-${Date.now()}`,
          question: "这道题怎么做？",
          mode: "direct",
          anonymous: false,
        },
      });
      const json = await res.json();
      console.log("task-bound create:", JSON.stringify(json).slice(0, 200));
      expect(res.status()).toBe(201);
      expect(json.data.taskId).toBe(MOLLY_TASK);
      // courseId 应该被自动反推（如果该 task 有 instance）
      console.log("inferred courseId:", json.data.courseId);

      await alex.request.delete(`${BASE}/api/study-buddy/posts/${json.data.id}`);
    } finally {
      await alex.context.close();
    }
  });
});

test.describe("Unit 6 B: 老师管理页", () => {
  test("B1: molly 进 /teacher/study-buddy → 200 + 看到统计与列表", async ({
    browser,
  }) => {
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const page = await molly.context.newPage();
      await page.goto(`${BASE}/teacher/study-buddy`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/01-teacher-mgmt.png`, fullPage: true });

      const body = await page.locator("body").innerText();
      expect(body).toContain("学生提问");
      expect(body).toContain("学习问答管理");

      // 应该至少有 tabs
      await expect(page.getByRole("tab", { name: /全部/ })).toBeVisible();
      await expect(page.getByRole("tab", { name: /未答疑/ })).toBeVisible();
      await expect(page.getByRole("tab", { name: /AI 已回复/ })).toBeVisible();
      await page.close();
    } finally {
      await molly.context.close();
    }
  });

  test("B2: API /api/teacher/study-buddy/posts 返回正确 shape + stats", async ({
    browser,
  }) => {
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const res = await molly.request.get(
        `${BASE}/api/teacher/study-buddy/posts`,
      );
      const json = await res.json();
      console.log("teacher posts stats:", JSON.stringify(json.data?.stats));
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("posts");
      expect(json.data).toHaveProperty("stats");
      expect(json.data.stats).toHaveProperty("total");
      expect(json.data.stats).toHaveProperty("pending");
      expect(json.data.stats).toHaveProperty("answered");
      expect(json.data.stats).toHaveProperty("students");
    } finally {
      await molly.context.close();
    }
  });

  test("B3: teacher sidebar 含「学生提问」nav 项", async ({ browser }) => {
    const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
    try {
      const page = await molly.context.newPage();
      await page.goto(`${BASE}/teacher/dashboard`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);
      const navLink = page.getByRole("link", { name: /学生提问/ });
      await expect(navLink.first()).toBeVisible();
      await page.close();
    } finally {
      await molly.context.close();
    }
  });
});

test.describe("Unit 6 C: UI 集成", () => {
  test("C1: dashboard ai-buddy-callout href 带 ?openNew=true", async ({
    browser,
  }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    try {
      const page = await alex.context.newPage();
      await page.goto(`${BASE}/dashboard`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000);
      // 寻找 callout 链接
      const callout = page.locator('a[href*="/study-buddy"][href*="openNew"]');
      const count = await callout.count();
      console.log("callout links with openNew:", count);
      expect(count).toBeGreaterThan(0);
      await page.close();
    } finally {
      await alex.context.close();
    }
  });

  test("C2: 学生 /study-buddy?openNew=true → dialog 自动打开 + 默认通用提问 mode", async ({
    browser,
  }) => {
    const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
    try {
      const page = await alex.context.newPage();
      await page.goto(`${BASE}/study-buddy?openNew=true`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/02-open-new.png`, fullPage: true });

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // segmented "通用提问" 应处于 pressed
      const generalBtn = page.getByRole("button", { name: /^通用提问$/ });
      await expect(generalBtn).toHaveAttribute("aria-pressed", "true");
      await page.close();
    } finally {
      await alex.context.close();
    }
  });
});
