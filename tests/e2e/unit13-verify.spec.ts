import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit13-verify";

const TEACHER1_COURSE = "940bbe23-6172-40bf-bc7f-b22a1840a1de"; // creator: teacher1, molly 是协作者

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
// A1: teacher1 协作 dialog 显示现有协作者 + 移除按钮
// ============================================
test("A1: teacher1 协作 Dialog 显示现有协作者列表 + '移除'按钮", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/courses/${TEACHER1_COURSE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  // 点击右上角"协作教师"按钮打开 dialog
  const btn = page.locator('button:has-text("协作教师")').first();
  await btn.click({ timeout: 10_000 });
  await page.waitForTimeout(800);

  // dialog 应显示"已添加 N 位"+ 列表
  const dialogText = await page.locator('[role="dialog"]').textContent();
  expect(dialogText).toBeTruthy();
  expect(dialogText).toContain("已添加");
  expect(dialogText).toContain("位协作教师");
  // 应有 molly 邮箱 (她是协作者)
  expect(dialogText).toContain("molly@qq.com");
  // "移除"按钮可见
  const removeBtn = page.locator('button:has-text("移除")').first();
  await expect(removeBtn).toBeVisible({ timeout: 5_000 });

  await page.screenshot({ path: `${SS}/A1-collab-dialog.png`, fullPage: true });
  await context.close();
});

// ============================================
// A2: 点击"移除"触发 AlertDialog 二次 confirm
// ============================================
test("A2: 点击 '移除' 后 AlertDialog 显示 '确定将 X 老师移出本课程协作'", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/courses/${TEACHER1_COURSE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  // 打开协作 dialog
  const btn = page.locator('button:has-text("协作教师")').first();
  await btn.click({ timeout: 10_000 });
  await page.waitForTimeout(800);

  // 点击列表中的"移除"
  const removeBtn = page.locator('button:has-text("移除")').first();
  await removeBtn.click({ timeout: 5_000 });
  await page.waitForTimeout(500);

  // AlertDialog 应显示 confirm 文案
  const alertText = await page.locator('[role="alertdialog"]').textContent();
  expect(alertText).toBeTruthy();
  expect(alertText).toContain("移除协作教师");
  expect(alertText).toContain("移出本课程协作");
  // 取消 + 确认移除 两按钮
  await expect(page.locator('[role="alertdialog"] >> text=取消').first()).toBeVisible();
  await expect(page.locator('[role="alertdialog"] >> text=确认移除').first()).toBeVisible();

  // 点取消 — 不真实移除
  await page.locator('[role="alertdialog"] >> text=取消').first().click();
  await page.waitForTimeout(300);
  // molly 仍应在协作列表
  const dialogTextAfter = await page.locator('[role="dialog"]').textContent();
  expect(dialogTextAfter).toContain("molly@qq.com");

  await page.screenshot({ path: `${SS}/A2-confirm.png`, fullPage: true });
  await context.close();
});

// ============================================
// B1: 学生 /courses/[id] 不应看到 "讨论" / "资源" tab
// ============================================
test("B1: 学生 /courses/[id] 不显示 '讨论' 和 '资源' tab", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await context.newPage();
  await page.goto(`${BASE}/courses/${TEACHER1_COURSE}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  // tab nav 中应有 内容/任务/成绩/公告
  const body = await page.textContent("body");
  expect(body).toBeTruthy();
  // 4 tab labels
  expect(body).toContain("内容");
  expect(body).toContain("任务");
  expect(body).toContain("成绩");
  expect(body).toContain("公告");

  // tab "讨论" / "资源" 不应作为 nav 链接出现
  // 用 link / button 角色定位（避免误击其他文字含"讨论"的内容如 "讨论 / 报告" 删除文案）
  const discussionTabs = await page
    .locator('a[role="tab"]:has-text("讨论"), button[role="tab"]:has-text("讨论"), [data-tab="discussion"]')
    .count();
  const resourcesTabs = await page
    .locator('a[role="tab"]:has-text("资源"), button[role="tab"]:has-text("资源"), [data-tab="resources"]')
    .count();
  expect(discussionTabs).toBe(0);
  expect(resourcesTabs).toBe(0);

  await page.screenshot({ path: `${SS}/B1-student-tabs.png`, fullPage: true });
  await context.close();
});
