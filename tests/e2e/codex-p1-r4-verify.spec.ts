import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const BASE = "http://localhost:3000";
const execAsync = promisify(exec);

// fixtures（seed 已存在）
const TEACHER1_ID = "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5"; // teacher1@finsim.edu.cn
const TEACHER2_ID = "ebbbeb19-a273-4bff-8289-f77abcbeb3fc"; // teacher2@finsim.edu.cn
const TEACHER1_COURSE_A = "00000000-0000-4000-8000-00000000a201"; // teacher1 owned course
const TEACHER1_COURSE_A_CLASS = "deedd844-e302-4b20-903d-d9b1d0e12439";
const TEACHER2_COURSE_B = "c779198b-6340-4959-8536-ce03da8adb52"; // teacher2 owned course
const TEACHER2_COURSE_B_CLASS = "1dbdc794-23c9-48dd-ba40-f0fbec3a1257";
const ALEX_ID = "236c3795-f19f-4107-a681-0bc0e1d21d62"; // student in class A
const ALEX_EMAIL = "alex@qq.com";

// Helper: 在 docker postgres 执行 SQL，返回 stdout
async function sql(query: string): Promise<string> {
  const escaped = query.replace(/"/g, '\\"');
  const { stdout } = await execAsync(
    `docker compose exec -T postgres psql -U finsim -d finsim -t -A -c "${escaped}"`,
    { cwd: process.cwd() },
  );
  return stdout.trim();
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
// P1: 老师 SB 管理页跨课程 over-match
// ============================================
test("P1-A: teacher2 不应在 SB 管理页看到 teacher1 课程的 post (over-match 已修)", async ({ browser }) => {
  const taskId = crypto.randomUUID();
  const instanceA = crypto.randomUUID();
  const instanceB = crypto.randomUUID();
  const postId = crypto.randomUUID();

  // Setup: SQL 创建 task X + 在 teacher1 course + teacher2 course 各开一个 instance + alex 发 post on instance_a
  // 这样 post.courseId = teacher1's course → teacher2 不应能看到（修前会因为 task-level over-match 看到）
  await sql(`
    INSERT INTO "Task" (id, "taskType", "taskName", "requirements", visibility, "creatorId", "createdAt", "updatedAt", "practiceEnabled")
    VALUES ('${taskId}', 'subjective', 'r4-P1-overmatch', '主观题描述', 'private', '${TEACHER1_ID}', NOW(), NOW(), false);
  `);
  await sql(`
    INSERT INTO "SubjectiveConfig" (id, "taskId", prompt, "allowTextAnswer", "allowedAttachmentTypes", "strictnessLevel", "updatedAt")
    VALUES (gen_random_uuid(), '${taskId}', 'test prompt', true, ARRAY[]::text[], 'MODERATE', NOW());
  `);
  // instance_a in teacher1 course
  await sql(`
    INSERT INTO "TaskInstance" (id, title, "taskId", "taskType", "classId", "courseId", "dueAt", status, "publishedAt", "createdBy", "createdAt", "updatedAt", "groupIds")
    VALUES ('${instanceA}', 'r4 inst A', '${taskId}', 'subjective', '${TEACHER1_COURSE_A_CLASS}', '${TEACHER1_COURSE_A}', NOW() + INTERVAL '7 days', 'published', NOW(), '${TEACHER1_ID}', NOW(), NOW(), ARRAY[]::text[]);
  `);
  // instance_b in teacher2 course (复用同 task)
  await sql(`
    INSERT INTO "TaskInstance" (id, title, "taskId", "taskType", "classId", "courseId", "dueAt", status, "publishedAt", "createdBy", "createdAt", "updatedAt", "groupIds")
    VALUES ('${instanceB}', 'r4 inst B', '${taskId}', 'subjective', '${TEACHER2_COURSE_B_CLASS}', '${TEACHER2_COURSE_B}', NOW() + INTERVAL '7 days', 'published', NOW(), '${TEACHER2_ID}', NOW(), NOW(), ARRAY[]::text[]);
  `);
  // alex post on instance_a (post.courseId = teacher1's course = TEACHER1_COURSE_A)
  await sql(`
    INSERT INTO "StudyBuddyPost" (id, "studentId", "taskId", "courseId", "taskInstanceId", title, question, mode, anonymous, "isPreview", status, "createdAt", "updatedAt")
    VALUES ('${postId}', '${ALEX_ID}', '${taskId}', '${TEACHER1_COURSE_A}', '${instanceA}', 'r4-P1-test', '问题', 'direct', false, false, 'pending', NOW(), NOW());
  `);

  try {
    // teacher2 GET 管理页
    const teacher2 = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
    try {
      const res = await teacher2.request.get(`${BASE}/api/teacher/study-buddy/posts?take=200`);
      expect(res.ok()).toBe(true);
      const json = await res.json();
      const posts = (json?.data?.posts ?? []) as Array<{ id: string; title: string }>;
      const leaked = posts.find((p) => p.id === postId);
      console.log(`P1-A teacher2 sees ${posts.length} posts; leaked over-match?`, !!leaked);
      expect(leaked).toBeUndefined();
    } finally {
      await teacher2.context.close();
    }

    // 反证：teacher1 (course owner) GET 应能看到该 post
    const teacher1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
    try {
      const res = await teacher1.request.get(`${BASE}/api/teacher/study-buddy/posts?take=200`);
      expect(res.ok()).toBe(true);
      const json = await res.json();
      const posts = (json?.data?.posts ?? []) as Array<{ id: string }>;
      const visible = posts.find((p) => p.id === postId);
      console.log(`P1-A teacher1 sees post?`, !!visible);
      expect(visible).toBeTruthy();
    } finally {
      await teacher1.context.close();
    }
  } finally {
    // Cleanup
    await sql(`DELETE FROM "StudyBuddyPost" WHERE id = '${postId}';`);
    await sql(`DELETE FROM "TaskInstance" WHERE id IN ('${instanceA}', '${instanceB}');`);
    await sql(`DELETE FROM "SubjectiveConfig" WHERE "taskId" = '${taskId}';`);
    await sql(`DELETE FROM "Task" WHERE id = '${taskId}';`);
  }
});

// ============================================
// P2: TaskBuildDraft 发布并发非原子
// ============================================
test("P2-A: 并发 publish 同 draftId → 1 个 201 + 1 个 4xx + DB 只 1 个 instance", async ({ browser }) => {
  const draftId = crypto.randomUUID();
  const chapterId = await sql(`SELECT id FROM "Chapter" WHERE "courseId" = '${TEACHER1_COURSE_A}' LIMIT 1;`);
  const sectionId = chapterId
    ? await sql(`SELECT id FROM "Section" WHERE "chapterId" = '${chapterId}' LIMIT 1;`)
    : "";

  // Setup: 创建 approved draft（teacher1 owns）
  await sql(`
    INSERT INTO "TaskBuildDraft" (id, "courseId", "chapterId", "sectionId", "taskType", title, description, status, progress, "sourceIds", "missingFields", "createdBy", "createdAt", "updatedAt", "approvedAt", "approvedBy")
    VALUES ('${draftId}', '${TEACHER1_COURSE_A}', ${chapterId ? `'${chapterId}'` : "NULL"}, ${sectionId ? `'${sectionId}'` : "NULL"}, 'subjective', 'r4-P2-race', 'concurrent publish test', 'approved', 100, ARRAY[]::text[], ARRAY[]::text[], '${TEACHER1_ID}', NOW(), NOW(), NOW(), '${TEACHER1_ID}');
  `);

  const teacher1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  try {
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const body = {
      task: {
        taskType: "subjective",
        taskName: "r4-P2-task-name",
        requirements: "describe",
        visibility: "private",
        practiceEnabled: false,
        subjectiveConfig: {
          prompt: "race test prompt",
          allowTextAnswer: true,
          allowedAttachmentTypes: [],
          strictnessLevel: "MODERATE",
        },
        scoringCriteria: [{ name: "维度1", maxPoints: 10, order: 0 }],
      },
      instance: {
        title: "r4-P2 instance",
        description: "race",
        classId: TEACHER1_COURSE_A_CLASS,
        groupIds: [],
        courseId: TEACHER1_COURSE_A,
        ...(chapterId && { chapterId }),
        ...(sectionId && { sectionId }),
        dueAt,
      },
      taskBuildDraftId: draftId,
    };

    // 并发发 2 个 POST 同 draftId
    const [r1, r2] = await Promise.all([
      teacher1.request.post(`${BASE}/api/lms/task-instances/with-task`, { data: body, failOnStatusCode: false }),
      teacher1.request.post(`${BASE}/api/lms/task-instances/with-task`, { data: body, failOnStatusCode: false }),
    ]);
    const s1 = r1.status();
    const s2 = r2.status();
    const j1 = await r1.json();
    const j2 = await r2.json();
    console.log("P2-A statuses:", s1, s2);
    console.log("P2-A bodies (truncated):", JSON.stringify(j1).slice(0, 250), "|", JSON.stringify(j2).slice(0, 250));

    // 一个 201 + 一个 4xx (含 NOT_APPROVED_FOR_PUBLISH)
    const statuses = [s1, s2].sort();
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    expect(statuses[1]).toBeLessThan(500);
    const errBody = s1 >= 400 ? j1 : j2;
    expect(String(errBody?.error?.code ?? errBody?.error?.message ?? ""))
      .toMatch(/TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH|NOT_APPROVED/);

    // DB verify: 只有 1 个 TaskInstance (taskBuildDraftId 在 taskSnapshot 没存，用 taskName 找)
    const taskCount = await sql(
      `SELECT COUNT(*) FROM "Task" WHERE "taskName" = 'r4-P2-task-name';`,
    );
    const instanceCount = await sql(
      `SELECT COUNT(*) FROM "TaskInstance" WHERE title = 'r4-P2 instance';`,
    );
    console.log("P2-A task/instance counts:", taskCount, instanceCount);
    expect(taskCount).toBe("1");
    expect(instanceCount).toBe("1");

    // DB verify: draft status 已 flip 到 published
    const draftStatus = await sql(
      `SELECT status FROM "TaskBuildDraft" WHERE id = '${draftId}';`,
    );
    expect(draftStatus).toBe("published");
  } finally {
    // Cleanup
    const taskRows = await sql(`SELECT id FROM "Task" WHERE "taskName" = 'r4-P2-task-name';`);
    if (taskRows) {
      const ids = taskRows.split("\n").map((s) => s.trim()).filter(Boolean);
      for (const tid of ids) {
        await sql(`DELETE FROM "TaskInstance" WHERE "taskId" = '${tid}';`);
        await sql(`DELETE FROM "SubjectiveConfig" WHERE "taskId" = '${tid}';`);
        await sql(`DELETE FROM "ScoringCriterion" WHERE "taskId" = '${tid}';`);
        await sql(`DELETE FROM "Task" WHERE id = '${tid}';`);
      }
    }
    await sql(`DELETE FROM "TaskBuildDraft" WHERE id = '${draftId}';`);
    await teacher1.context.close();
  }
});

// ============================================
// P2 regression: 单 publish（非并发）仍正常工作
// ============================================
test("P2-B: 单 publish flow 仍正常工作（regression）", async ({ browser }) => {
  const draftId = crypto.randomUUID();

  await sql(`
    INSERT INTO "TaskBuildDraft" (id, "courseId", "taskType", title, description, status, progress, "sourceIds", "missingFields", "createdBy", "createdAt", "updatedAt", "approvedAt", "approvedBy")
    VALUES ('${draftId}', '${TEACHER1_COURSE_A}', 'subjective', 'r4-P2-B-single', 'single publish', 'approved', 100, ARRAY[]::text[], ARRAY[]::text[], '${TEACHER1_ID}', NOW(), NOW(), NOW(), '${TEACHER1_ID}');
  `);

  const teacher1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  try {
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const body = {
      task: {
        taskType: "subjective",
        taskName: "r4-P2-B-single-task",
        requirements: "describe",
        visibility: "private",
        practiceEnabled: false,
        subjectiveConfig: {
          prompt: "single test prompt",
          allowTextAnswer: true,
          allowedAttachmentTypes: [],
          strictnessLevel: "MODERATE",
        },
        scoringCriteria: [{ name: "维度1", maxPoints: 10, order: 0 }],
      },
      instance: {
        title: "r4-P2-B instance",
        description: "single",
        classId: TEACHER1_COURSE_A_CLASS,
        groupIds: [],
        courseId: TEACHER1_COURSE_A,
        dueAt,
      },
      taskBuildDraftId: draftId,
    };

    const res = await teacher1.request.post(`${BASE}/api/lms/task-instances/with-task`, {
      data: body,
      failOnStatusCode: false,
    });
    console.log("P2-B single publish status:", res.status());
    expect(res.status()).toBe(201);
    const draftStatus = await sql(
      `SELECT status FROM "TaskBuildDraft" WHERE id = '${draftId}';`,
    );
    expect(draftStatus).toBe("published");
  } finally {
    const taskRows = await sql(`SELECT id FROM "Task" WHERE "taskName" = 'r4-P2-B-single-task';`);
    if (taskRows) {
      const ids = taskRows.split("\n").map((s) => s.trim()).filter(Boolean);
      for (const tid of ids) {
        await sql(`DELETE FROM "TaskInstance" WHERE "taskId" = '${tid}';`);
        await sql(`DELETE FROM "SubjectiveConfig" WHERE "taskId" = '${tid}';`);
        await sql(`DELETE FROM "ScoringCriterion" WHERE "taskId" = '${tid}';`);
        await sql(`DELETE FROM "Task" WHERE id = '${tid}';`);
      }
    }
    await sql(`DELETE FROM "TaskBuildDraft" WHERE id = '${draftId}';`);
    await teacher1.context.close();
  }
});
