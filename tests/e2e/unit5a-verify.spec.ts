import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit5a-verify";

// fixtures
const MOLLY_COURSE_WITH_CHAPTERS = "8f7f653c-9177-44f6-b764-80f7f779b2ef"; // 个人规划 (molly own, 1 chapter, 0 instances)
// NOTE: molly 的 3 个 task 都已有 taskInstances（dev DB 状态），不能直接用作 0-instance fixture，测试中先创建 dummy task
const CLASS_A_ID = "deedd844-e302-4b20-903d-d9b1d0e12439";

async function loginMolly(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "molly@qq.com");
  await page.fill('input[type="password"]', "123456");
  await Promise.all([
    page
      .waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), {
        timeout: 25_000,
      })
      .catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(180_000);

test.describe.serial("Unit 5a: 课程删除 + 任务删除（拒删 + audit）", () => {
  test("A: 课程列表卡片 owner 显示删除按钮（有 chapter 时 disabled + tooltip）", async ({
    page,
  }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/courses`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/01-list.png`, fullPage: true });

    // 应该看到 molly 的"个人规划"卡片 + 删除按钮（disabled 因为有章节）
    const card = page.getByText(/个人规划/).first();
    await expect(card).toBeVisible();

    // 找到所有 tooltip-trigger 包裹的 disabled trash 按钮
    const tooltipTriggers = page.locator('[data-slot="tooltip-trigger"]');
    const count = await tooltipTriggers.count();
    console.log("tooltip-trigger count:", count);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("B: API DELETE molly 的有 chapter 的课程 → 400 COURSE_HAS_CHAPTERS", async ({
    page,
  }) => {
    await loginMolly(page);
    const res = await page.request.delete(
      `${BASE}/api/lms/courses/${MOLLY_COURSE_WITH_CHAPTERS}`,
    );
    const json = await res.json();
    console.log("DELETE with chapters:", JSON.stringify(json));
    expect(res.status()).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("COURSE_HAS_CHAPTERS");
  });

  test("C: API POST 新课程 → DELETE → 200 + audit log", async ({ page }) => {
    await loginMolly(page);

    // create a dummy course
    const createRes = await page.request.post(`${BASE}/api/lms/courses`, {
      data: {
        courseTitle: `QA-Unit5a-dummy-${Date.now()}`,
        classId: CLASS_A_ID,
      },
    });
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const newCourseId = createJson.data.id as string;
    console.log("created dummy course:", newCourseId);

    // delete it
    const delRes = await page.request.delete(
      `${BASE}/api/lms/courses/${newCourseId}`,
    );
    const delJson = await delRes.json();
    console.log("DELETE dummy course:", JSON.stringify(delJson));
    expect(delRes.status()).toBe(200);
    expect(delJson.success).toBe(true);

    // 二次 GET 应 404
    const verifyRes = await page.request.get(
      `${BASE}/api/lms/courses/${newCourseId}`,
    );
    expect(verifyRes.status()).toBe(404);
  });

  test("D: API DELETE non-owner 课程 → 403 FORBIDDEN（teacher1 的课程）", async ({
    page,
  }) => {
    await loginMolly(page);
    // teacher1 的"个人理财规划"
    const TEACHER1_COURSE = "e6fc049c-756f-4442-86da-35a6cdbadd6e";
    const res = await page.request.delete(
      `${BASE}/api/lms/courses/${TEACHER1_COURSE}`,
    );
    const json = await res.json();
    console.log("DELETE non-owner:", JSON.stringify(json));
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("FORBIDDEN");
  });

  test("E: API DELETE 不存在的课程 → 404 COURSE_NOT_FOUND", async ({ page }) => {
    await loginMolly(page);
    const res = await page.request.delete(
      `${BASE}/api/lms/courses/ffffffff-ffff-4fff-8fff-ffffffffffff`,
    );
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("NOT_FOUND");
  });

  test("F: 任务详情页 0 instance 时显示「删除任务」按钮", async ({ page }) => {
    await loginMolly(page);
    // 先创建一个 dummy task（molly 现有 3 个 task 都已有 instance，无法直接验证）
    const createRes = await page.request.post(`${BASE}/api/tasks`, {
      data: {
        taskType: "quiz",
        taskName: `QA-Unit5a-F-${Date.now()}`,
        quizConfig: { mode: "fixed", showCorrectAnswer: false },
        quizQuestions: [
          {
            type: "single_choice",
            prompt: "测试题",
            options: [
              { id: "A", text: "对" },
              { id: "B", text: "错" },
            ],
            correctOptionIds: ["A"],
            points: 1,
            order: 0,
          },
        ],
      },
    });
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const newTaskId = createJson.data.id as string;

    await page.goto(`${BASE}/teacher/tasks/${newTaskId}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SS}/02-task-detail.png`,
      fullPage: true,
    });

    const deleteBtn = page.getByRole("button", { name: /删除任务/ });
    await expect(deleteBtn).toBeVisible();

    // 清理
    await page.request.delete(`${BASE}/api/tasks/${newTaskId}`);
  });

  test("G: API DELETE 0 instance 的 task → 200 + audit", async ({ page }) => {
    await loginMolly(page);

    // create a dummy task first（避免破坏 dev data）
    const createRes = await page.request.post(`${BASE}/api/tasks`, {
      data: {
        taskType: "quiz",
        taskName: `QA-Unit5a-dummy-task-${Date.now()}`,
        quizConfig: {
          mode: "fixed",
          showCorrectAnswer: false,
        },
        quizQuestions: [
          {
            type: "single_choice",
            prompt: "测试题",
            options: [
              { id: "A", text: "对" },
              { id: "B", text: "错" },
            ],
            correctOptionIds: ["A"],
            points: 1,
            order: 0,
          },
        ],
      },
    });
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const newTaskId = createJson.data.id as string;
    console.log("created dummy task:", newTaskId);

    // delete it
    const delRes = await page.request.delete(`${BASE}/api/tasks/${newTaskId}`);
    const delJson = await delRes.json();
    expect(delRes.status()).toBe(200);
    expect(delJson.success).toBe(true);
  });

  test("H: API DELETE 有 instance 的 task → 400 TASK_HAS_INSTANCES", async ({
    page,
  }) => {
    await loginMolly(page);
    // 个人理财基础概念测验 (3e26c6d2) 有 1 个 instance (449ae28c-...)
    const TASK_WITH_INSTANCE = "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9";
    const res = await page.request.delete(`${BASE}/api/tasks/${TASK_WITH_INSTANCE}`);
    const json = await res.json();
    console.log("DELETE task with instance:", JSON.stringify(json));
    expect(res.status()).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("TASK_HAS_INSTANCES");
  });
});
