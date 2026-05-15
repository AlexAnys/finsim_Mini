import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";

// 已有 A 班 published task
const A_CLASS_TASK = "6018c58c-06ce-4a2f-9f0e-df366aca5f28"; // 理财基础知识测验 (A班)
const A_CLASS = "deedd844-e302-4b20-903d-d9b1d0e12439";
const B_CLASS = "1dbdc794-23c9-48dd-ba40-f0fbec3a1257";

function runSql(sql: string): string {
  return execSync(
    `docker exec -i acc4fef29d82_finsim-postgres psql -U finsim -d finsim -t -A`,
    { encoding: "utf8", input: sql },
  ).trim();
}

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
// P1-r3-A: alex 用 A 班 task → 201 + 服务端反推 A 班 courseId
// ============================================
test("P1-r3-A: alex (A班) 用 A 班 task id → 201 + post.courseId = A 班 course", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskId: A_CLASS_TASK,
      title: "Codex-P1-r3-test-A",
      question: "测试问题",
      mode: "direct",
      anonymous: false,
    },
  });
  expect(res.status()).toBe(201);
  const json = await res.json();
  expect(json.success).toBe(true);
  const post = json.data?.id ? json.data : json.data?.post;
  expect(post?.courseId).toBeTruthy();

  // 验证服务端持久化的 courseId 来自 A 班 instance
  const courseClassId = runSql(
    `SELECT "classId" FROM "Course" WHERE id='${post.courseId}'`,
  );
  // 该 course 应直接关联 A 班 OR 有 CourseClass 关联 A 班
  const courseClassMatch = runSql(
    `SELECT COUNT(*) FROM "Course" WHERE id='${post.courseId}' AND ("classId"='${A_CLASS}' OR id IN (SELECT "courseId" FROM "CourseClass" WHERE "classId"='${A_CLASS}'))`,
  );
  expect(parseInt(courseClassMatch, 10)).toBeGreaterThan(0);
  void courseClassId;

  // cleanup
  if (post?.id) {
    await request.delete(`${BASE}/api/study-buddy/posts/${post.id}`);
  }
  await context.close();
});

// ============================================
// P1-r3-B: 模拟多班复用 — DB inject 一个 B 班 instance 复用 A_CLASS_TASK，
//          alex 用此 taskId 仍解析到 A 班 courseId（不是新加的 B 班 instance.courseId）
// ============================================
test("P1-r3-B: task 复用 A+B 班场景 → alex 解析到 A 班 courseId 不被 B 班污染", async ({ browser }) => {
  // 1. 查 A 班 instance 当前 courseId（baseline 期望值）
  const expectedCourseId = runSql(
    `SELECT "courseId" FROM "TaskInstance" WHERE "taskId"='${A_CLASS_TASK}' AND "classId"='${A_CLASS}' AND status='published' LIMIT 1`,
  );
  expect(expectedCourseId).toBeTruthy();

  // 2. inject 一个 B 班 instance 复用此 task，用 B 班 course
  const bCourseId = "00000000-0000-4000-8000-00000000a202"; // B 班 course (个人理财规划 B班)
  const injectedInstanceId = runSql(
    `INSERT INTO "TaskInstance" (id, title, description, "taskId", "taskType", "classId", "courseId", "dueAt", status, "createdBy", "createdAt", "updatedAt", "groupIds") VALUES (gen_random_uuid(), 'CODEX-P1-r3-test-B-class-instance', 'transient e2e fixture', '${A_CLASS_TASK}', 'quiz', '${B_CLASS}', '${bCourseId}', '2026-12-31', 'published', '4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5', NOW(), NOW(), '{}') RETURNING id`,
  );

  try {
    const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
    const res = await request.post(`${BASE}/api/study-buddy/posts`, {
      data: {
        taskId: A_CLASS_TASK,
        title: "Codex-P1-r3-test-B",
        question: "task 复用多班测试",
        mode: "direct",
        anonymous: false,
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    const post = json.data?.id ? json.data : json.data?.post;

    // 关键断言：服务端解析到 A 班 instance.courseId，不是 B 班 bCourseId
    expect(post?.courseId).toBe(expectedCourseId);
    expect(post?.courseId).not.toBe(bCourseId);

    // cleanup post
    if (post?.id) {
      await request.delete(`${BASE}/api/study-buddy/posts/${post.id}`);
    }
    await context.close();
  } finally {
    // cleanup injected instance
    runSql(`DELETE FROM "TaskInstance" WHERE id='${injectedInstanceId}'`);
  }
});

// ============================================
// P1-r3-C: 学生不属任何班直接用 taskId → 403（边角防御）
// ============================================
test("P1-r3-C: 用 B 班 only task (alex 无 A 班 instance) → assertTaskReadable 先拦 403", async ({ browser }) => {
  const B_ONLY_TASK = "00000000-0000-4000-8000-00000000b501"; // B 班独立测验
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const res = await request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskId: B_ONLY_TASK,
      title: "Codex-P1-r3-test-C",
      question: "应该被 assertTaskReadable 先拦",
      mode: "direct",
      anonymous: false,
    },
  });
  // assertTaskReadable 先拦 — 403 (alex 不在 B 班 instance)
  expect(res.status()).toBe(403);
  await context.close();
});
