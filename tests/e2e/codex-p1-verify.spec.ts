import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";

// Bug 1 fixtures: adaptive quiz instance + task in A 班 (alex/belle), student5 in B 班
const ADAPTIVE_TASK = "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53"; // 深度测试
const ADAPTIVE_INSTANCE = "a7d9b380-49fd-4ce2-9d95-000935ac0c5a"; // A 班 instance
const ADAPTIVE_INSTANCE_2 = "d288859e-f2e9-4ceb-96d4-127295444ccb"; // 理财基础自适应 A 班
const ADAPTIVE_TASK_2 = "9cd29095-7131-4a93-8395-69283666859d";

// Bug 2 fixtures: A 班 course (alex 可关联), B 班 course (alex 不可关联)
const COURSE_A_CLASS = "940bbe23-6172-40bf-bc7f-b22a1840a1de"; // 个人理财规划 A 班
const COURSE_B_CLASS = "00000000-0000-4000-8000-00000000a202"; // 个人理财规划 B 班 (alex 不在此班)

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
// Bug 1: adaptive-quiz/next 跨班拒收
// ============================================
test("Bug1-A: alex (A班) 调自己班 adaptive instance → 200/OK (positive)", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(
    `${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/adaptive-quiz/next`,
    { data: { history: [], taskInstanceId: ADAPTIVE_INSTANCE } },
  );
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.success).toBe(true);
  // 应返回 nextQuestion 或 fallback (knowledgeTagIds 未 tag 时)
  expect(json.data).toHaveProperty("done");
  await context.close();
});

test("Bug1-B: student5 (B班) 调 A 班 adaptive instance → 403 跨班拒收", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "student5@finsim.edu.cn", "password123");
  const res = await request.post(
    `${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/adaptive-quiz/next`,
    { data: { history: [], taskInstanceId: ADAPTIVE_INSTANCE } },
  );
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
  // 应是 403 类（FORBIDDEN / 跨班）
  const json = await res.json();
  expect(json.success).toBe(false);
  await context.close();
});

test("Bug1-C: 伪造 instanceId 不匹配 taskId → 403 FORBIDDEN", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  // ADAPTIVE_INSTANCE_2 的 task 是 ADAPTIVE_TASK_2，不匹配 ADAPTIVE_TASK
  const res = await request.post(
    `${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/adaptive-quiz/next`,
    { data: { history: [], taskInstanceId: ADAPTIVE_INSTANCE_2 } },
  );
  expect(res.status()).toBe(403);
  const json = await res.json();
  expect(json.error?.code).toBe("FORBIDDEN");
  expect(json.error?.message).toContain("不匹配");
  await context.close();
});

test("Bug1-D: 缺 taskInstanceId → 400 VALIDATION_ERROR", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(
    `${BASE}/api/lms/tasks/${ADAPTIVE_TASK}/adaptive-quiz/next`,
    { data: { history: [] } },
  );
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json.error?.code).toBe("VALIDATION_ERROR");
  await context.close();
});

// ============================================
// Bug 2: SB 自由问 courseId ownership
// ============================================
test("Bug2-A: alex (A班) 自由问 + courseId=A班课 → 201 OK", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      courseId: COURSE_A_CLASS,
      title: "Codex-P1-test-bug2-A",
      question: "测试问题：什么是复利？",
      mode: "direct",
      anonymous: false,
    },
  });
  expect(res.status()).toBe(201);
  const json = await res.json();
  expect(json.success).toBe(true);
  const postId = json.data?.id ?? json.data?.post?.id;

  // Cleanup
  if (postId) {
    await request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  }
  await context.close();
});

test("Bug2-B: alex (A班) 自由问 + courseId=B班课 → 403 COURSE_ACCESS_DENIED 中文", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      courseId: COURSE_B_CLASS,
      title: "Codex-P1-test-bug2-B",
      question: "尝试跨班关联",
      mode: "direct",
      anonymous: false,
    },
  });
  expect(res.status()).toBe(403);
  const json = await res.json();
  expect(json.error?.code).toBe("COURSE_ACCESS_DENIED");
  expect(json.error?.message).toContain("不在该课程的班级");
  await context.close();
});

test("Bug2-C: alex 自由问 不传 courseId → 201 OK (admin-bin 兜底)", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      title: "Codex-P1-test-bug2-C",
      question: "通用问题，无 course 关联",
      mode: "direct",
      anonymous: false,
    },
  });
  expect(res.status()).toBe(201);
  const json = await res.json();
  expect(json.success).toBe(true);
  const postId = json.data?.id ?? json.data?.post?.id;

  // Cleanup
  if (postId) {
    await request.delete(`${BASE}/api/study-buddy/posts/${postId}`);
  }
  await context.close();
});
