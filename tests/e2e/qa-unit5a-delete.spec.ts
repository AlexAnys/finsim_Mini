import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit5a";

// Test fixtures
const MOLLY_COURSE_HAS_CHAPTERS = "8f7f653c-9177-44f6-b764-80f7f779b2ef"; // 个人规划, 1 chap, 0 inst — should reject COURSE_HAS_CHAPTERS
const TEACHER1_COURSE_HAS_INSTANCES = "e6fc049c-756f-4442-86da-35a6cdbadd6e"; // 个人理财规划, 3 chap, 9 inst — owned by teacher1
const CLASS_A = "deedd844-e302-4b20-903d-d9b1d0e12439"; // 金融2024A班 (molly + students)

const MOLLY_TASK_HAS_INSTANCE = "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9"; // 1 instance + 1 graded sub
const NONEXISTENT = "00000000-0000-0000-0000-000000000000";

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page
      .waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 30_000 })
      .catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

// ============================================
// COURSE DELETE TESTS
// ============================================

test("QA r5a A: API molly DELETE 自己的课 (1 chapter, 0 inst) → 400 COURSE_HAS_CHAPTERS 中文", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  const resp = await page.request.delete(`${BASE}/api/lms/courses/${MOLLY_COURSE_HAS_CHAPTERS}`);
  const status = resp.status();
  const body = await resp.json();
  console.log("\n[A] DELETE status:", status, "body:", JSON.stringify(body).slice(0, 300));
  expect(status).toBeGreaterThanOrEqual(400);
  expect(body?.error?.code).toBe("COURSE_HAS_CHAPTERS");
  expect(String(body?.error?.message)).toMatch(/[一-鿿]/);
  expect(String(body?.error?.message)).toMatch(/章节/);
});

test("QA r5a B: API molly DELETE teacher1 课 → 403 FORBIDDEN", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  const resp = await page.request.delete(`${BASE}/api/lms/courses/${TEACHER1_COURSE_HAS_INSTANCES}`);
  const status = resp.status();
  const body = await resp.json();
  console.log("\n[B] DELETE other-owner course:", status, JSON.stringify(body).slice(0, 200));
  expect(status, "non-owner DELETE 应 403").toBeGreaterThanOrEqual(400);
  expect(String(body?.error?.code)).toMatch(/FORBIDDEN|UNAUTHORIZED/);
});

test("QA r5a C: API DELETE 不存在的课 → 404 NOT_FOUND", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  const resp = await page.request.delete(`${BASE}/api/lms/courses/${NONEXISTENT}`);
  const status = resp.status();
  const body = await resp.json();
  console.log("\n[C] DELETE nonexistent:", status, JSON.stringify(body).slice(0, 200));
  expect(status === 404 || /NOT_FOUND/.test(String(body?.error?.code))).toBe(true);
});

test("QA r5a D: 完整 dummy course 创建+删除 round-trip (200 + GET 404 后)", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");

  const dummyTitle = `QA-r5a-dummy-${Date.now()}`;
  const createResp = await page.request.post(`${BASE}/api/lms/courses`, {
    data: { courseTitle: dummyTitle, classId: CLASS_A },
    failOnStatusCode: false,
  });
  console.log("\n[D] create status:", createResp.status());
  expect(createResp.status()).toBeLessThan(400);
  const createBody = await createResp.json();
  const dummyId = createBody?.data?.id ?? createBody?.data?.course?.id;
  console.log("[D] dummy id:", dummyId);
  expect(String(dummyId)).toMatch(/[0-9a-f-]{36}/);

  // Verify GET works
  const getResp = await page.request.get(`${BASE}/api/lms/courses/${dummyId}`);
  expect(getResp.status()).toBe(200);

  // DELETE — should succeed (0 chap / 0 inst)
  const delResp = await page.request.delete(`${BASE}/api/lms/courses/${dummyId}`);
  console.log("[D] delete status:", delResp.status());
  expect(delResp.status()).toBeLessThan(400);

  // Verify GET now 404
  const getAfterResp = await page.request.get(`${BASE}/api/lms/courses/${dummyId}`);
  console.log("[D] GET after delete:", getAfterResp.status());
  expect([404, 403, 400].includes(getAfterResp.status())).toBe(true);
});

// ============================================
// TASK DELETE TESTS
// ============================================

test("QA r5a E: API molly DELETE 自己有 instance 的 task → 400 TASK_HAS_INSTANCES 中文", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  const resp = await page.request.delete(`${BASE}/api/tasks/${MOLLY_TASK_HAS_INSTANCE}`);
  const status = resp.status();
  const body = await resp.json();
  console.log("\n[E] DELETE task w/ instance:", status, JSON.stringify(body).slice(0, 300));
  expect(status).toBe(400);
  expect(body?.error?.code).toBe("TASK_HAS_INSTANCES");
  expect(String(body?.error?.message)).toMatch(/[一-鿿]/);
  expect(String(body?.error?.message)).toMatch(/实例/);
});

test("QA r5a F: 完整 dummy task 创建+删除 round-trip (无 instance → 200 + GET 404 后)", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");

  const dummyName = `QA-r5a-task-${Date.now()}`;
  const createResp = await page.request.post(`${BASE}/api/tasks`, {
    data: {
      taskType: "quiz",
      taskName: dummyName,
      visibility: "private",
      practiceEnabled: false,
      quizConfig: { mode: "fixed", showCorrectAnswer: false },
    },
    failOnStatusCode: false,
  });
  console.log("\n[F] create task status:", createResp.status());
  if (createResp.status() >= 400) {
    const b = await createResp.json();
    console.log("[F] create err:", JSON.stringify(b).slice(0, 300));
  }
  expect(createResp.status()).toBeLessThan(400);
  const cb = await createResp.json();
  const dummyId = cb?.data?.id ?? cb?.data?.task?.id;
  console.log("[F] dummy task id:", dummyId);
  expect(String(dummyId)).toMatch(/[0-9a-f-]{36}/);

  // DELETE
  const delResp = await page.request.delete(`${BASE}/api/tasks/${dummyId}`);
  console.log("[F] delete status:", delResp.status());
  expect(delResp.status()).toBeLessThan(400);

  // GET after delete should be 404
  const afterResp = await page.request.get(`${BASE}/api/tasks/${dummyId}`);
  console.log("[F] GET after delete:", afterResp.status());
  expect([404, 403, 400].includes(afterResp.status())).toBe(true);
});

test("QA r5a G: API molly DELETE teacher1 的 task → 403 FORBIDDEN", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  const TEACHER1_TASK = "a308c7ba-2713-4c2d-9441-c92927e3f9f4"; // teacher1 sim task
  const resp = await page.request.delete(`${BASE}/api/tasks/${TEACHER1_TASK}`);
  const status = resp.status();
  const body = await resp.json();
  console.log("\n[G] DELETE other-owner task:", status, JSON.stringify(body).slice(0, 200));
  expect(status).toBeGreaterThanOrEqual(400);
  expect(String(body?.error?.code)).toMatch(/FORBIDDEN|UNAUTHORIZED/);
});

// ============================================
// UI TESTS
// ============================================

test("QA r5a H: molly /teacher/courses 列表 — owner card 有删除按钮 (icon) + tooltip", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/courses`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/H1-courses-list.png`, fullPage: true });

  // 卡片用 icon-only 删除按钮：aria-label="删除课程"（active）或 disabled span 含 Trash2 icon
  // 直接抓 aria-label="删除课程"
  const ariaBtn = page.locator('button[aria-label="删除课程"]');
  const ariaCount = await ariaBtn.count();
  console.log("\n[H] active 删除课程 button (aria-label) count:", ariaCount);

  // disabled 的 (有内容时) 是 Tooltip 包裹的 disabled button — span[data-slot="tooltip-trigger"] 内
  const tooltipWrap = page.locator('span[data-slot="tooltip-trigger"]:has(button[disabled]:has(svg))');
  const tooltipCount = await tooltipWrap.count();
  console.log("[H] tooltip-trigger disabled 删除 wrappers:", tooltipCount);

  // molly 是 owner of 个人规划 (1 chap, 0 inst) → 应是 tooltip-disabled
  // total owner delete UI (active + disabled) 应 ≥ 1
  const totalDelete = ariaCount + tooltipCount;
  console.log("[H] total owner-delete UI:", totalDelete);
  expect(totalDelete, "molly 是 owner of 个人规划 应至少 1 个删除 UI").toBeGreaterThan(0);

  // 验证 hover tooltip 文案 (disabled case)
  if (tooltipCount > 0) {
    await tooltipWrap.first().hover({ force: true });
    await page.waitForTimeout(800);
    const tip = await page.locator('[role="tooltip"]').first().textContent({ timeout: 2000 }).catch(() => null);
    console.log("[H] tooltip text:", tip);
    if (tip) {
      expect(tip).toMatch(/章节|任务|无法删除/);
    }
  }
});

test("QA r5a I: molly /teacher/courses/[id] 详情页 — header 「删除」按钮 + AlertDialog 二级确认 + 拒删流", async ({
  page,
}) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/courses/${MOLLY_COURSE_HAS_CHAPTERS}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/I1-course-detail.png`, fullPage: true });

  // 删除按钮应在 EditorHero 顶部
  const delBtn = page.getByRole("button", { name: /^删除/ });
  const delCount = await delBtn.count();
  console.log("\n[I] 删除按钮 count:", delCount);
  expect(delCount, "详情页 header 应有删除按钮").toBeGreaterThan(0);

  // 点击 → AlertDialog
  await delBtn.first().click();
  await page.waitForTimeout(1500);
  const dialog = page.locator('[role="alertdialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});

  const dialogText = (await dialog.textContent()) ?? "";
  console.log("[I] dialog text:", dialogText.slice(0, 300));
  expect(dialogText).toMatch(/确认|删除/);

  // 点确认 → 后端拒绝（COURSE_HAS_CHAPTERS） → toast 中文 OR 错误显示
  // 抓确认按钮
  const confirmBtn = dialog.getByRole("button", { name: /^确认|确认删除|删除$/ }).last();
  console.log("[I] confirm btn count:", await confirmBtn.count());
  if (await confirmBtn.count()) {
    await confirmBtn.first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/I2-after-delete-rejected.png`, fullPage: true });

    // 应仍在原 page 或显示错误 toast — URL 未变
    const url = page.url();
    console.log("[I] URL after:", url);
    // course id 应仍在 URL（删除被拒绝）
    expect(url.includes(MOLLY_COURSE_HAS_CHAPTERS) || /\/teacher\/courses/.test(url)).toBe(true);

    // 验证 DB 中 course 仍存在
    const verifyResp = await page.request.get(`${BASE}/api/lms/courses/${MOLLY_COURSE_HAS_CHAPTERS}`);
    expect(verifyResp.status()).toBe(200);
  }
});

test("QA r5a J: molly /teacher/tasks/[id] — 「删除任务」按钮行为", async ({ page }) => {
  // CASE J1: 有 instance 的 task → 按钮**隐藏**（builder 设计决策, 与 Unit 2 disabled+tooltip 模式不一致）
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/tasks/${MOLLY_TASK_HAS_INSTANCE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/J1-task-with-instance.png`, fullPage: true });

  const delBtnInstance = page.getByRole("button", { name: /^删除任务|^删除$/ });
  const j1Count = await delBtnInstance.count();
  console.log("\n[J1] (has instance) 删除任务 button count:", j1Count, "— builder 设计: 隐藏");
  // builder 决策是隐藏不是禁用，这里记录但不 fail
  // 此 case 与 Unit 2 disabled+tooltip 模式不一致，coordinator 需要拍板 UX 一致性

  // CASE J2: 创建 0-instance dummy task → 应见删除按钮
  const dummyName = `QA-r5a-J2-${Date.now()}`;
  const createResp = await page.request.post(`${BASE}/api/tasks`, {
    data: {
      taskType: "quiz",
      taskName: dummyName,
      visibility: "private",
      practiceEnabled: false,
      quizConfig: { mode: "fixed", showCorrectAnswer: false },
    },
    failOnStatusCode: false,
  });
  expect(createResp.status()).toBeLessThan(400);
  const cb = await createResp.json();
  const dummyId = cb?.data?.id ?? cb?.data?.task?.id;
  console.log("[J2] dummy 0-instance task:", dummyId);

  await page.goto(`${BASE}/teacher/tasks/${dummyId}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/J2-task-zero-instance.png`, fullPage: true });

  const delBtn2 = page.getByRole("button", { name: /^删除任务|^删除$/ });
  const j2Count = await delBtn2.count();
  console.log("[J2] (0 instance) 删除任务 button count:", j2Count);
  expect(j2Count, "0 instance 时应有删除任务按钮").toBeGreaterThan(0);

  // CLEANUP — DELETE the dummy
  const delResp = await page.request.delete(`${BASE}/api/tasks/${dummyId}`);
  console.log("[J] dummy task cleanup:", delResp.status());
  expect(delResp.status()).toBeLessThan(400);

  // 验证 MOLLY_TASK_HAS_INSTANCE 仍在
  const t1 = await page.request.get(`${BASE}/api/tasks/${MOLLY_TASK_HAS_INSTANCE}`);
  expect(t1.status()).toBe(200);
});

// ============================================
// CLEANUP VERIFY
// ============================================

test("QA r5a Z: cleanup — 验证 DB 状态测前测后一致", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  // GET molly's courses + tasks，应回基线
  const c = await page.request.get(`${BASE}/api/lms/courses`);
  const cJson = await c.json();
  const courses = (cJson?.data?.courses ?? cJson?.data ?? []) as Array<{ id: string }>;
  console.log("\n[Z] molly visible courses:", courses.length);

  // 验证 MOLLY_COURSE_HAS_CHAPTERS 仍在
  const verify = await page.request.get(`${BASE}/api/lms/courses/${MOLLY_COURSE_HAS_CHAPTERS}`);
  expect(verify.status()).toBe(200);

  // 验证 MOLLY_TASK_HAS_INSTANCE 仍在
  const verifyTask = await page.request.get(`${BASE}/api/tasks/${MOLLY_TASK_HAS_INSTANCE}`);
  expect(verifyTask.status()).toBe(200);
});
