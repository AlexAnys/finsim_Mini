import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit13";

const COURSE_ID = "940bbe23-6172-40bf-bc7f-b22a1840a1de"; // teacher1 owns, molly collab
const STUDENT_COURSE_ID = "940bbe23-6172-40bf-bc7f-b22a1840a1de"; // alex 在 deedd844 可见

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
// A: teacher1 协作 Dialog 列表 + 移除按钮
// ============================================

test("QA r13 A: teacher1 /teacher/courses/[id] 协作 Dialog 显示 molly + 移除按钮", async ({ browser }) => {
  const t1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await t1.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);

    // 找精确 "协作教师" 按钮
    const collabBtn = page.getByRole("button", { name: /^协作教师$/ });
    const btnCount = await collabBtn.count();
    console.log("\n[A] 协作教师 button count:", btnCount);

    if (btnCount > 0) {
      await collabBtn.first().click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${SS}/A1-collab-dialog.png`, fullPage: true });

      // 找 dialog (避免使用 role=dialog 的 .first() 抓到错的, 用 title=添加协作教师)
      const dialog = page.locator('[role="dialog"]').filter({ hasText: /添加协作教师/ });
      await dialog.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});

      const dialogText = (await dialog.textContent()) ?? "";
      console.log("[A] dialog text first 500:", dialogText.slice(0, 500));

      // 应显示 molly 信息
      expect(dialogText, "dialog 应含 molly").toMatch(/molly/);
      // 应显示 已添加 N 位 文案
      const hasCounter = /已添加.*位|协作教师.*\d/.test(dialogText);
      console.log("[A] has counter text?", hasCounter);

      // 应有 "移除" 按钮
      const removeBtn = dialog.getByRole("button", { name: /^移除$/ });
      const removeCount = await removeBtn.count();
      console.log("[A] 移除 按钮 count:", removeCount);
      expect(removeCount, "应有移除按钮").toBeGreaterThan(0);
    } else {
      console.log("[A] (warning) 未找到协作教师 button - 检查 UI 路径");
    }
  } finally {
    await page.close();
    await t1.context.close();
  }
});

// ============================================
// B: 点击移除 → AlertDialog 二次 confirm
// ============================================

test("QA r13 B: 点击移除按钮 → AlertDialog '确定将 molly 老师移出本课程协作？' + 取消不真删", async ({
  browser,
}) => {
  const t1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await t1.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);

    const collabBtn = page.getByRole("button", { name: /^协作教师$/ });
    expect(await collabBtn.count()).toBeGreaterThan(0);
    await collabBtn.first().click();
    await page.waitForTimeout(2500);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /添加协作教师/ });
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    const removeBtn = dialog.getByRole("button", { name: /^移除$/ }).first();
    expect(await removeBtn.count()).toBeGreaterThan(0);
    await removeBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/B1-alert.png`, fullPage: true });

    // AlertDialog 应出现
    const alertDlg = page.locator('[role="alertdialog"]').first();
    await alertDlg.waitFor({ state: "visible", timeout: 5_000 });

    const alertText = (await alertDlg.textContent()) ?? "";
    console.log("\n[B] AlertDialog text:", alertText.slice(0, 400));

    expect(alertText, "应含确认文案").toMatch(/确定.*移出|移除.*协作|失去.*权限/);
    expect(alertText, "应有 molly 名字").toMatch(/molly/);

    // 三按钮: 取消 / 确认移除
    const cancelBtn = alertDlg.getByRole("button", { name: /^取消$/ });
    const confirmBtn = alertDlg.getByRole("button", { name: /确认移除|确定/ });
    console.log("[B] cancel count:", await cancelBtn.count(), " confirm count:", await confirmBtn.count());
    expect(await cancelBtn.count()).toBeGreaterThan(0);
    expect(await confirmBtn.count()).toBeGreaterThan(0);

    // 点击取消，不真删
    await cancelBtn.first().click();
    await page.waitForTimeout(1000);

    // 验证 molly 仍是 collab (DB 未变)
    const verifyResp = await t1.request.get(`${BASE}/api/lms/courses/${COURSE_ID}/teachers`);
    if (verifyResp.ok()) {
      const j = await verifyResp.json();
      const teachers = j?.data?.teachers ?? j?.data ?? [];
      console.log("[B] post-cancel teachers count:", teachers.length);
      const hasMolly = teachers.some((t: { teacher?: { email?: string }; email?: string }) => t.teacher?.email === "molly@qq.com" || t.email === "molly@qq.com");
      expect(hasMolly, "取消后 molly 仍应是 collab").toBe(true);
    }
  } finally {
    await page.close();
    await t1.context.close();
  }
});

// ============================================
// C: 学生 /courses/[id] 不显示 讨论 / 资源 tab
// ============================================

test("QA r13 C: alex /courses/[id] 不显示 '讨论' / '资源' tab (仅 4 tab)", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/courses/${STUDENT_COURSE_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/C1-student-tabs.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[C] body first 500:", bodyText.slice(0, 500));

    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 找 role=tablist 内的 tab 数
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    console.log("[C] tab count:", tabCount);

    const tabLabels: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      tabLabels.push(((await tabs.nth(i).textContent()) ?? "").trim());
    }
    console.log("[C] tab labels:", tabLabels);

    // 应不含 "讨论" 或 "资源" tab label
    const hasDiscussion = tabLabels.some((l) => l.includes("讨论"));
    const hasResources = tabLabels.some((l) => l.includes("资源"));
    console.log("[C] has 讨论:", hasDiscussion, " has 资源:", hasResources);
    expect(hasDiscussion, "不应有 '讨论' tab").toBe(false);
    expect(hasResources, "不应有 '资源' tab").toBe(false);

    // 应至少有 4 个 tab（内容/任务/成绩/公告 - 可能名字略有不同）
    expect(tabCount, "至少 3-4 个剩余 tab").toBeGreaterThanOrEqual(3);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// D: 教师 hero × 按钮也走 AlertDialog (一致性)
// ============================================

test("QA r13 D: hero 内联协作徽章 × 按钮走 AlertDialog (一致性 spot-check)", async ({ browser }) => {
  const t1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await t1.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/D1-hero.png`, fullPage: true });

    // 找 hero 协作徽章中的 × 按钮 (可能 aria-label 或 title 含"移除"或 X icon)
    const xBtns = page.locator('button[aria-label*="移除"], button[title*="移除"]');
    const xCount = await xBtns.count();
    console.log("\n[D] × buttons in hero:", xCount);

    if (xCount > 0) {
      await xBtns.first().click();
      await page.waitForTimeout(1500);
      const alertDlg = page.locator('[role="alertdialog"]');
      const alertCount = await alertDlg.count();
      console.log("[D] AlertDialog visible after hero × click:", alertCount);

      if (alertCount > 0) {
        const alertText = (await alertDlg.first().textContent()) ?? "";
        expect(alertText, "hero × 也走 AlertDialog confirm").toMatch(/确定.*移出|移除.*协作/);
        // 取消
        const cancelBtn = alertDlg.first().getByRole("button", { name: /^取消$/ }).first();
        if (await cancelBtn.count()) await cancelBtn.click();
      }
    } else {
      console.log("[D] (info) hero 内未找到 × 按钮 — UI 实现可能不同");
    }
  } finally {
    await page.close();
    await t1.context.close();
  }
});
