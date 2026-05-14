import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit3";

const CLOSED_INST_ALEX_HAS_SUB = "449ae28c-8913-43f5-adda-dc296885071b";
const ALEX_SUB_ID_ON_CLOSED = "ce7f935d-5ed0-4af0-9aeb-53a527de372c";
const PUB_INST = "7db59a62-e806-44c6-b102-e767f61ed8bb";
const NONEXISTENT = "00000000-0000-0000-0000-000000000000";

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
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

test("QA Unit 3 A: alex sidebar 有「任务中心」+ /tasks 加载 200 (acceptance 1+2)", async ({ page }) => {
  await loginAs(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/A1-dashboard.png`, fullPage: true });

  const navLink = page.locator('nav a, [role="navigation"] a').filter({ hasText: /任务中心/ });
  const navCount = await navLink.count();
  console.log("\n[A] sidebar「任务中心」link count:", navCount);
  expect(navCount, "sidebar 应有「任务中心」").toBeGreaterThan(0);

  await navLink.first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/A2-tasks-page.png`, fullPage: true });

  const url = page.url();
  console.log("[A] URL after click:", url);
  expect(url, "应跳转到 /tasks").toMatch(/\/tasks$/);

  const bodyText = (await page.textContent("body")) ?? "";
  const is404 = /404|not\s*found|页面不存在|找不到/i.test(bodyText.slice(0, 1000));
  console.log("[A] 是否 404 页面?", is404);
  expect(is404, "页面不应是 404").toBe(false);
});

test("QA Unit 3 B: /tasks 有 4 tab + 课程/类型筛选 (acceptance 1)", async ({ page }) => {
  // capture console errors instead of regex-matching body text (which has false-positive "ErrorState")
  const consoleErrors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => {
    consoleErrors.push(String(e?.message ?? e));
  });

  await loginAs(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/B1-tasks-full.png`, fullPage: true });

  const bodyText = (await page.textContent("body")) ?? "";

  // spec: 4 tabs
  const tabPatterns = [/待办/, /进行中/, /已批改/, /已结束/];
  const tabHits = tabPatterns.map((p) => p.test(bodyText));
  console.log("\n[B] 4 tab matches:", tabHits, "all?", tabHits.every(Boolean));
  expect(tabHits.filter(Boolean).length, "应有 4 个 tab 文案").toBeGreaterThanOrEqual(4);

  // role=tab 实际计数
  const tabRoles = await page.locator('[role="tab"]').count();
  console.log("[B] role=tab count:", tabRoles);
  expect(tabRoles, "应有 ≥4 个 role=tab").toBeGreaterThanOrEqual(4);

  // 课程 + 类型 select 真实可见
  const courseSelect = page.locator('select, [role="combobox"]').filter({ hasText: /全部课程|个人理财规划/ });
  const typeSelect = page.locator('select, [role="combobox"]').filter({ hasText: /全部类型|测验|模拟|主观/ });
  const csCount = await courseSelect.count();
  const tsCount = await typeSelect.count();
  console.log("[B] 课程 select count:", csCount, "  类型 select count:", tsCount);
  expect(csCount, "应有课程筛选 select").toBeGreaterThan(0);
  expect(tsCount, "应有类型筛选 select").toBeGreaterThan(0);

  // 4 tab 切换 — 用 console error 判断而非 body text regex
  for (const tabLabel of ["待办", "进行中", "已批改", "已结束"]) {
    const before = consoleErrors.length;
    const t = page.getByRole("tab", { name: new RegExp(tabLabel) }).first();
    if (await t.count()) {
      await t.click({ force: true });
      await page.waitForTimeout(800);
      const newErrs = consoleErrors.slice(before);
      console.log(`[B] click "${tabLabel}": new console errors:`, newErrs.length);
      if (newErrs.length) {
        newErrs.slice(0, 3).forEach((e) => console.log("  -", e.slice(0, 200)));
      }
      // 允许少量"benign" warning（如未挂载的 React DevTools），过滤后再断言
      const realErrs = newErrs.filter(
        (e) =>
          !/React DevTools|HMR|favicon/i.test(e) &&
          !/Failed to load resource.*favicon/i.test(e),
      );
      expect(realErrs.length, `tab "${tabLabel}" 切换不应触发 console error`).toBe(0);
    }
  }
});

test("QA Unit 3 C: alex on closed-with-own-sub → 200 + 只读 banner (acceptance 3)", async ({ page }) => {
  await loginAs(page, "alex@qq.com", "11");

  const apiResp = await page.request.get(`${BASE}/api/lms/task-instances/${CLOSED_INST_ALEX_HAS_SUB}`);
  console.log("\n[C] API GET alex closed-with-own-sub:", apiResp.status());
  expect(apiResp.status(), "API 应 200 (有自己 sub)").toBe(200);

  const body = await apiResp.json();
  console.log("[C] body.data.status:", body?.data?.status);
  expect(body?.data?.status).toBe("closed");

  await page.goto(`${BASE}/tasks/${CLOSED_INST_ALEX_HAS_SUB}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/C1-closed-with-sub.png`, fullPage: true });

  const bodyText = (await page.textContent("body")) ?? "";
  console.log("[C] page body first 500:", bodyText.slice(0, 500));

  const notForbidden = !/权限不足|403|你还不能进入|尚未开放|不在该任务班级/.test(bodyText);
  console.log("[C] 不是 403?:", notForbidden);
  expect(notForbidden, "alex 应能进入 closed-with-sub 页面").toBe(true);

  const hasReadOnlyBanner = /任务已结束|只读|已关闭|查看.*提交|我的成绩/.test(bodyText);
  console.log("[C] 有只读 banner?:", hasReadOnlyBanner);
  expect(hasReadOnlyBanner, "应有只读 banner 文案").toBe(true);
});

test("QA Unit 3 D: belle on closed (no own sub) → 403 + 「任务已结束」错误码 (acceptance 4)", async ({
  page,
}) => {
  await loginAs(page, "belle@qq.com", "11");

  const apiResp = await page.request.get(`${BASE}/api/lms/task-instances/${CLOSED_INST_ALEX_HAS_SUB}`);
  console.log("\n[D] API GET belle on closed-no-own-sub:", apiResp.status());
  expect(apiResp.status(), "应 403").toBeGreaterThanOrEqual(400);

  const body = await apiResp.json();
  console.log("[D] body:", JSON.stringify(body).slice(0, 300));

  const code = body?.error?.code;
  const message = body?.error?.message;
  console.log("[D] error.code:", code, " message:", message);

  const hasClosedCode =
    /CLOSED|TASK_INSTANCE_CLOSED|TASK_CLOSED|FORBIDDEN/.test(String(code)) &&
    /[一-鿿]/.test(String(message));
  console.log("[D] 中文 + 明确错误码?:", hasClosedCode);
  expect(hasClosedCode, "应有明确的 closed-related 错误码 + 中文消息").toBe(true);
  expect(String(message), "消息应含'任务已结束'语义").toMatch(/任务.*(?:结束|关闭|已)/);

  await page.goto(`${BASE}/tasks/${CLOSED_INST_ALEX_HAS_SUB}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  const bodyText = (await page.textContent("body")) ?? "";
  console.log("[D] belle 页面文案:", bodyText.slice(0, 400));
  await page.screenshot({ path: `${SS}/D1-belle-closed.png`, fullPage: true });
  const hasClosedText = /任务已结束|结束/.test(bodyText);
  expect(hasClosedText, "页面应显示'任务已结束'相关文案而非 generic 权限不足").toBe(true);
});

test("QA Unit 3 E: 跨班学生 student5 → published instance 仍 403 (regression)", async ({ page }) => {
  await loginAs(page, "student5@finsim.edu.cn", "password123");

  const apiResp = await page.request.get(`${BASE}/api/lms/task-instances/${PUB_INST}`);
  console.log("\n[E] API GET cross-class student5 on published 7db59a62:", apiResp.status());
  expect(apiResp.status(), "跨班应 403").toBeGreaterThanOrEqual(400);

  const body = await apiResp.json();
  console.log("[E] body:", JSON.stringify(body).slice(0, 300));

  const code = body?.error?.code;
  const message = body?.error?.message;
  console.log("[E] code:", code, " msg:", message);
  expect(String(code), "跨班应是 FORBIDDEN/通用").toMatch(/FORBIDDEN|UNAUTHORIZED|NOT_IN_CLASS/);
  // 跨班错误消息不应泄漏 published/closed 状态
  expect(String(message), "跨班错误消息不应泄漏 published/closed 状态").not.toMatch(/已结束|尚未开放/);
});

test("QA Unit 3 F: 不存在的 instance ID → 404 而非 403", async ({ page }) => {
  await loginAs(page, "alex@qq.com", "11");

  const apiResp = await page.request.get(`${BASE}/api/lms/task-instances/${NONEXISTENT}`);
  console.log("\n[F] API GET nonexistent:", apiResp.status());

  const body = await apiResp.json().catch(() => null);
  console.log("[F] body:", JSON.stringify(body).slice(0, 300));

  const status = apiResp.status();
  const code = body?.error?.code;
  const isCorrect404 = status === 404 || /NOT_FOUND/.test(String(code));
  console.log("[F] is 404 semantic?:", isCorrect404);
  expect(isCorrect404, "不存在的 instance 应 404 而非 generic 403").toBe(true);
});

test("QA Unit 3 G: dashboard graded-closed [结果] 跳 /grades?focus=<sid> (acceptance 5)", async ({ page }) => {
  await loginAs(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/G1-alex-dashboard.png`, fullPage: true });

  const focusLinks = page.locator(`a[href*="focus="]`);
  const focusCount = await focusLinks.count();
  console.log("\n[G] focus= links count:", focusCount);

  if (focusCount > 0) {
    const hrefs: string[] = [];
    for (let i = 0; i < focusCount && i < 10; i++) {
      const href = await focusLinks.nth(i).getAttribute("href");
      hrefs.push(String(href));
    }
    console.log("[G] focus= hrefs:", hrefs);

    const hasFocusGrades = hrefs.some(
      (h) => /\/grades\?focus=[0-9a-f-]{36}/.test(h),
    );
    expect(hasFocusGrades, "dashboard 应有 /grades?focus=<sid> 链接").toBe(true);

    // 期望至少 1 个 href 是 alex closed sub
    const hasAlexSpecific = hrefs.some((h) => h.includes(ALEX_SUB_ID_ON_CLOSED));
    console.log("[G] 含 alex's closed-sub focus?", hasAlexSpecific);
  } else {
    console.log("[G] (info) 0 个 focus= 链接 — dashboard 没显示 closed-with-sub 任务");
    expect(focusCount, "expected at least one focus= link in dashboard").toBeGreaterThan(0);
  }
});

test("QA Unit 3 H: /grades?focus=<id> 选中行 + 内容渲染", async ({ page }) => {
  await loginAs(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/grades?focus=${ALEX_SUB_ID_ON_CLOSED}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/H1-grades-focus.png`, fullPage: true });

  const bodyText = (await page.textContent("body")) ?? "";
  console.log("\n[H] /grades?focus body first 500:", bodyText.slice(0, 500));

  // 应展示 closed 任务标题
  const hasClosedTaskTitle = /个人理财基础概念测验/.test(bodyText);
  console.log("[H] 显示 closed 任务标题:", hasClosedTaskTitle);
  expect(hasClosedTaskTitle, "应展示 closed 任务标题 (focus 派生 selected)").toBe(true);
});

test("QA Unit 3 I: closed-with-own-sub 不允许 submit/eval (回归 — strict mode 保留)", async ({ page }) => {
  await loginAs(page, "alex@qq.com", "11");

  const submitResp = await page.request.post(`${BASE}/api/submissions`, {
    data: {
      taskInstanceId: CLOSED_INST_ALEX_HAS_SUB,
      taskType: "quiz",
      answers: [],
    },
    failOnStatusCode: false,
  });
  console.log("\n[I] POST submission on closed:", submitResp.status());
  expect(submitResp.status(), "closed strict 应拒绝新提交").toBeGreaterThanOrEqual(400);

  const body = await submitResp.json().catch(() => null);
  console.log("[I] body:", JSON.stringify(body).slice(0, 300));
});
