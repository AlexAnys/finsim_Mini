import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit-fb1-verify";

const MOLLY_INSTANCE = "a7d9b380-49fd-4ce2-9d95-000935ac0c5a"; // molly's 深度测试 adaptive instance
const MOLLY_TASK = "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53";

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
// A1: instance 页 overview tab 顶部有 "任务配置" 折叠卡
// ============================================
test("A1: molly 进 instance 详情看到 '任务配置' 折叠卡 (默认收起)", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/instances/${MOLLY_INSTANCE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const trigger = page.locator('button[aria-expanded]:has-text("任务配置")').first();
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  const expanded = await trigger.getAttribute("aria-expanded");
  expect(expanded).toBe("false"); // 默认收起

  await page.screenshot({ path: `${SS}/A1-collapsed.png`, fullPage: true });
  await context.close();
});

// ============================================
// A2: 展开后显示 read-only summary + "编辑任务配置 →" 按钮
// ============================================
test("A2: 展开折叠卡显示概览 + 编辑链接含 returnTo 参数", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/instances/${MOLLY_INSTANCE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const trigger = page.locator('button[aria-expanded]:has-text("任务配置")').first();
  await trigger.click();
  await page.waitForTimeout(1500);

  // 应显示任务名 + 类型 + 评分维度
  const body = await page.textContent("body");
  expect(body).toBeTruthy();
  expect(body).toContain("任务名");
  expect(body).toContain("类型");
  expect(body).toContain("评分维度");
  expect(body).toContain("深度测试"); // task name

  // 编辑链接 href 含 returnTo
  const editLink = page.locator('a:has-text("编辑任务配置")').first();
  await expect(editLink).toBeVisible({ timeout: 5_000 });
  const href = await editLink.getAttribute("href");
  expect(href).toContain(`/teacher/tasks/${MOLLY_TASK}`);
  expect(href).toContain("edit=true");
  expect(href).toContain(`returnTo=${encodeURIComponent("/teacher/instances/" + MOLLY_INSTANCE)}`);

  await page.screenshot({ path: `${SS}/A2-expanded.png`, fullPage: true });
  await context.close();
});

// ============================================
// A3: 点击编辑链接 → 跳到 /teacher/tasks/[id]?edit=true&returnTo=...
// ============================================
test("A3: 点编辑跳到 task 编辑页 (URL 含 returnTo)", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/instances/${MOLLY_INSTANCE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const trigger = page.locator('button[aria-expanded]:has-text("任务配置")').first();
  await trigger.click();
  await page.waitForTimeout(1500);

  await page.locator('a:has-text("编辑任务配置")').first().click();
  await page.waitForURL((u) => u.pathname === `/teacher/tasks/${MOLLY_TASK}`, {
    timeout: 10_000,
  });

  const url = page.url();
  expect(url).toContain("edit=true");
  expect(url).toContain("returnTo=");

  await context.close();
});

// ============================================
// A4: 在 task 编辑页点取消 → router.push(returnTo) 回 instance 页
// ============================================
test("A4: task 编辑页点取消 → 自动回 instance 页 (returnTo 闭环)", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  const returnTo = `/teacher/instances/${MOLLY_INSTANCE}`;
  await page.goto(
    `${BASE}/teacher/tasks/${MOLLY_TASK}?edit=true&returnTo=${encodeURIComponent(returnTo)}`,
  );
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  // 找编辑模式下的"取消"按钮
  const cancelBtn = page.locator('button:has-text("取消")').first();
  await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
  await cancelBtn.click();

  // 等待 redirect 到 instance 页
  await page.waitForURL((u) => u.pathname === `/teacher/instances/${MOLLY_INSTANCE}`, {
    timeout: 10_000,
  });
  const url = page.url();
  expect(url).toContain(`/teacher/instances/${MOLLY_INSTANCE}`);

  await context.close();
});

// ============================================
// A5: 不带 returnTo 直接访问 /teacher/tasks/[id] 不破坏
// ============================================
test("A5: 直接访问 /teacher/tasks/[id] (无 returnTo) 取消不跳转", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/tasks/${MOLLY_TASK}?edit=true`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const cancelBtn = page.locator('button:has-text("取消")').first();
  await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
  await cancelBtn.click();
  await page.waitForTimeout(500);

  // 应仍在 task 页 (不跳转)
  const url = page.url();
  expect(url).toContain(`/teacher/tasks/${MOLLY_TASK}`);

  await context.close();
});
