import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";

// fixtures
const ADAPTIVE_TASK_A = "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53"; // 深度测试
const ADAPTIVE_INSTANCE_A = "a7d9b380-49fd-4ce2-9d95-000935ac0c5a"; // A班 instance
const QUESTION_FROM_A = "4fc6dedc-7bc7-46f2-a956-2994f8fe6a60"; // 深度测试 single_choice
const QUESTION_FROM_OTHER = "b8047af8-d994-49d2-babb-3eba8b9ecc3e"; // 理财基础 task 的题（不属于 task A）

// SB Bug2 (taskId 分支) fixtures
const TASK_A_FOR_SB = "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53"; // alex 通过此 task 能看到 instance
const COURSE_B_BOGUS = "00000000-0000-4000-8000-00000000a202"; // 别班 course，alex 不属于

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
// P1-3: /api/lms/quiz-questions/[id]/check 加 taskInstanceId required + access check
// ============================================
test("P1-3-A: alex (A班) 调自己班 question check → 200 OK (positive)", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(
    `${BASE}/api/lms/quiz-questions/${QUESTION_FROM_A}/check`,
    {
      data: {
        taskInstanceId: ADAPTIVE_INSTANCE_A,
        selectedOptionIds: ["A"],
      },
    },
  );
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.success).toBe(true);
  expect(json.data).toHaveProperty("correct");
  expect(json.data).toHaveProperty("correctOptionIds");
  await context.close();
});

test("P1-3-B: student5 (B班) 调 A班 question check → 4xx 跨班拒收", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "student5@finsim.edu.cn", "password123");
  const res = await request.post(
    `${BASE}/api/lms/quiz-questions/${QUESTION_FROM_A}/check`,
    {
      data: {
        taskInstanceId: ADAPTIVE_INSTANCE_A,
        selectedOptionIds: ["A"],
      },
    },
  );
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
  const json = await res.json();
  expect(json.success).toBe(false);
  await context.close();
});

test("P1-3-C: 缺 taskInstanceId → 400 VALIDATION_ERROR", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(
    `${BASE}/api/lms/quiz-questions/${QUESTION_FROM_A}/check`,
    { data: { selectedOptionIds: ["A"] } },
  );
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json.error?.code).toBe("VALIDATION_ERROR");
  await context.close();
});

test("P1-3-D: 伪造 instanceId 不匹配 question.taskId → 403 FORBIDDEN", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  // QUESTION_FROM_OTHER 属于 task 9cd29095，不属于 ADAPTIVE_INSTANCE_A 的 task e54e1cb9
  const res = await request.post(
    `${BASE}/api/lms/quiz-questions/${QUESTION_FROM_OTHER}/check`,
    {
      data: {
        taskInstanceId: ADAPTIVE_INSTANCE_A,
        selectedOptionIds: ["A"],
      },
    },
  );
  expect(res.status()).toBe(403);
  const json = await res.json();
  expect(json.error?.code).toBe("FORBIDDEN");
  expect(json.error?.message).toContain("不匹配");
  await context.close();
});

// ============================================
// P1-2 r2: SB createPost taskId 分支强制覆盖 client courseId
// ============================================
test("P1-2-A: alex 用 taskId + bogus courseId=别班 → 201 OK 服务端忽略 bogus 用 instance 反推", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  // alex 通过 TASK_A_FOR_SB 能看到 instance (A班)；client 传 bogus B班 courseId
  // 服务端应忽略 client courseId，用 instance.courseId 反推
  const res = await request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskId: TASK_A_FOR_SB,
      courseId: COURSE_B_BOGUS, // bogus，期望被服务端覆盖
      title: "Codex-P1-r2-test-P1-2-A",
      question: "测试问题",
      mode: "direct",
      anonymous: false,
    },
  });
  expect(res.status()).toBe(201);
  const json = await res.json();
  expect(json.success).toBe(true);
  const post = json.data?.id ? json.data : json.data?.post;
  expect(post).toBeTruthy();
  // 服务端持久化的 courseId 应为 instance 反推值，不是 bogus B班
  expect(post.courseId).not.toBe(COURSE_B_BOGUS);

  // cleanup
  if (post?.id) {
    await request.delete(`${BASE}/api/study-buddy/posts/${post.id}`);
  }
  await context.close();
});

// ============================================
// P1-1 r1 (regression): adaptive-quiz/next 仍正常工作
// ============================================
test("P1-1-A: adaptive-quiz/next regression (r1 fix 仍 OK)", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(
    `${BASE}/api/lms/tasks/${ADAPTIVE_TASK_A}/adaptive-quiz/next`,
    { data: { history: [], taskInstanceId: ADAPTIVE_INSTANCE_A } },
  );
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.success).toBe(true);
  await context.close();
});
