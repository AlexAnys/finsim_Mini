import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit5a-r2";

const MOLLY_TASK_HAS_INSTANCE = "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9"; // 1 instance — should disabled+Tooltip
const MOLLY_COURSE_HAS_CHAPTERS = "8f7f653c-9177-44f6-b764-80f7f779b2ef"; // r1 spot-check target

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

test.setTimeout(120_000);
test.describe.configure({ mode: "serial" });

// ============================================
// NEW: r2 disabled + tooltip 模式
// ============================================

test("QA r5a r2 A: 有 instance 的 task → 删除按钮 disabled + Tooltip 中文 (Finding A 修)", async ({
  page,
}) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/tasks/${MOLLY_TASK_HAS_INSTANCE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/A1-task-detail.png`, fullPage: true });

  // 删除任务 button 应该存在但 disabled
  const delBtn = page.getByRole("button", { name: /^删除任务$/ });
  const delCount = await delBtn.count();
  console.log("\n[A] 「删除任务」 button count:", delCount);
  expect(delCount, "应有删除任务按钮（不再 hidden）").toBeGreaterThan(0);

  const isDisabled = await delBtn.first().isDisabled();
  console.log("[A] disabled?", isDisabled);
  expect(isDisabled, "有 instance 时应 disabled").toBe(true);

  // Tooltip hover via span wrapper
  const tooltipWrap = page
    .locator('span[data-slot="tooltip-trigger"]')
    .filter({ has: page.getByRole("button", { name: /^删除任务$/ }) });
  const wrapCount = await tooltipWrap.count();
  console.log("[A] tooltip-trigger wrapper count:", wrapCount);
  expect(wrapCount, "disabled button 应被 tooltip-trigger span 包裹 (Radix 模式)").toBeGreaterThan(0);

  await tooltipWrap.first().hover({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/A2-tooltip-hover.png`, fullPage: true });

  const tipText = await page
    .locator('[role="tooltip"]')
    .first()
    .textContent({ timeout: 3000 })
    .catch(() => null);
  console.log("[A] tooltip text:", tipText);
  expect(tipText, "tooltip 应有内容").toBeTruthy();
  // Per build report: "该任务已发布 N 个实例，请先删除实例再删任务"
  expect(String(tipText)).toMatch(/[一-鿿]/);
  expect(String(tipText)).toMatch(/实例|无法删除|删除/);
});

// ============================================
// 0 instance regression: 按钮仍可点 + dialog 正常
// ============================================

test("QA r5a r2 B: 0 instance 的 task → 删除按钮可点 + AlertDialog 弹出 (regression)", async ({
  page,
}) => {
  await loginAs(page, "molly@qq.com", "123456");

  // 创建 dummy 0-instance task
  const dummyName = `QA-r5a-r2-B-${Date.now()}`;
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
  console.log("\n[B] dummy 0-instance task id:", dummyId);

  // 进 page
  await page.goto(`${BASE}/teacher/tasks/${dummyId}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  // 删除按钮应可见且不 disabled
  const delBtn = page.getByRole("button", { name: /^删除任务$/ }).first();
  expect(await delBtn.count(), "0 instance 应有删除按钮").toBeGreaterThan(0);
  expect(await delBtn.isDisabled(), "0 instance 不应 disabled").toBe(false);

  // 点击 → 弹 AlertDialog
  await delBtn.click();
  await page.waitForTimeout(1500);
  const dialog = page.locator('[role="alertdialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  const dialogText = (await dialog.textContent()) ?? "";
  console.log("[B] dialog text:", dialogText.slice(0, 300));
  expect(dialogText).toMatch(/确认|删除/);

  // 点取消 → cleanup
  const cancelBtn = dialog.getByRole("button", { name: /^取消$/ }).first();
  if (await cancelBtn.count()) {
    await cancelBtn.click();
    await page.waitForTimeout(500);
  } else {
    await page.keyboard.press("Escape");
  }

  // 验证 task 还在
  const verifyResp = await page.request.get(`${BASE}/api/tasks/${dummyId}`);
  expect(verifyResp.status()).toBe(200);

  // ===== cleanup: 删 dummy =====
  const delResp = await page.request.delete(`${BASE}/api/tasks/${dummyId}`);
  console.log("[B] cleanup status:", delResp.status());
  expect(delResp.status()).toBeLessThan(400);
});

// ============================================
// SPOT-CHECK r1 not broken
// ============================================

test("QA r5a r2 C: spot-check r1 — API DELETE 有 instance task → 400 TASK_HAS_INSTANCES (regression)", async ({
  page,
}) => {
  await loginAs(page, "molly@qq.com", "123456");
  const resp = await page.request.delete(`${BASE}/api/tasks/${MOLLY_TASK_HAS_INSTANCE}`);
  const body = await resp.json();
  console.log("\n[C] DELETE has-instance:", resp.status(), JSON.stringify(body).slice(0, 200));
  expect(resp.status()).toBe(400);
  expect(body?.error?.code).toBe("TASK_HAS_INSTANCES");
  expect(String(body?.error?.message)).toMatch(/[一-鿿]/);
  expect(String(body?.error?.message)).toMatch(/实例/);
});

test("QA r5a r2 D: spot-check r1 — 课程详情页 删除 dialog 仍中文 (regression)", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/courses/${MOLLY_COURSE_HAS_CHAPTERS}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  const delBtn = page.getByRole("button", { name: /^删除/ }).first();
  expect(await delBtn.count()).toBeGreaterThan(0);
  await delBtn.click();
  await page.waitForTimeout(1500);

  const dialog = page.locator('[role="alertdialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  const dialogText = (await dialog.textContent()) ?? "";
  console.log("\n[D] course dialog text:", dialogText.slice(0, 300));
  expect(dialogText).toMatch(/删除课程|删除/);

  // 取消，不实际触发
  const cancelBtn = dialog.getByRole("button", { name: /^取消$/ }).first();
  if (await cancelBtn.count()) {
    await cancelBtn.click();
  } else {
    await page.keyboard.press("Escape");
  }
});
