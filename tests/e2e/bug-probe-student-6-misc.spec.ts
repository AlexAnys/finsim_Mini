import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/bug-probe-student";

async function login(page: Page, email: string, password: string) {
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
}

test.setTimeout(300_000);

test("STU-GRADES-1: 我的成绩页 + 已批改但未公布的处理", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/grades`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/50-grades-page.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("GRADES PAGE (3000):", body.slice(0, 3000));

  // 是否区分"未公布"
  const releasedHint = await page.locator("text=/未公布|等待教师公布|已分析|等待 AI/").count();
  console.log("未公布相关文案数:", releasedHint);

  // 评分详情面板
  const evalPanel = await page.locator("text=/评估详情|得分点|量规/").count();
  console.log("评估详情/量规相关数:", evalPanel);

  // 点一条记录
  const rows = page.locator('[role="row"], button[data-row], li').filter({ hasText: /理财|风险|配置|测验|主观|模拟/ });
  console.log("可点 row 数:", await rows.count());

  console.log("STU-GRADES-1 CONSOLE ERRORS:", consoleErrors.slice(0, 6));
});

test("STU-COURSES-1: 我的课程主页 + 课程详情 + Tabs", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: `${SS}/51-courses-list.png`, fullPage: true });

  // 点第一个 course
  const cardLink = page.locator('a[href*="/courses/"]').first();
  if ((await cardLink.count()) > 0) {
    await cardLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: `${SS}/52-course-detail-tabs.png`, fullPage: true });
    const body = await page.locator("body").innerText();
    console.log("COURSE DETAIL (3500):", body.slice(0, 3500));

    // tabs
    const tabs = ["内容", "任务", "成绩", "公告", "讨论", "资源"];
    for (const tab of tabs) {
      const cnt = await page.locator(`text=${tab}`).count();
      console.log(`Tab [${tab}]: ${cnt}`);
    }

    // 点 "任务" tab
    const taskTab = page.getByRole("tab", { name: /任务/ });
    if ((await taskTab.count()) > 0) {
      await taskTab.click();
      await page.waitForTimeout(1_000);
      await page.screenshot({ path: `${SS}/53-course-tab-tasks.png`, fullPage: true });
      const taskBody = await page.locator("body").innerText();
      console.log("课程任务 tab:", taskBody.slice(0, 1500));
    }

    // 点 公告
    const annTab = page.getByRole("tab", { name: /公告/ });
    if ((await annTab.count()) > 0) {
      await annTab.click();
      await page.waitForTimeout(1_000);
      await page.screenshot({ path: `${SS}/54-course-tab-announce.png`, fullPage: true });
    }

    // 点 资源
    const resTab = page.getByRole("tab", { name: /资源/ });
    if ((await resTab.count()) > 0) {
      await resTab.click();
      await page.waitForTimeout(1_000);
      await page.screenshot({ path: `${SS}/55-course-tab-resources.png`, fullPage: true });
      const resBody = await page.locator("body").innerText();
      console.log("资源 tab:", resBody.slice(0, 1500));
    }
  }

  console.log("STU-COURSES-1 CONSOLE ERRORS:", consoleErrors.slice(0, 6));
});

test("STU-SETTINGS: 学生设置页", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: `${SS}/56-settings.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("SETTINGS (2000):", body.slice(0, 2000));
  console.log("STU-SETTINGS CONSOLE ERRORS:", consoleErrors.slice(0, 6));
});

test("STU-ERR-1: 不存在的任务 ID", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks/ffffffff-0000-0000-0000-000000000000`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/60-task-not-found.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("不存在任务页:", body.slice(0, 1500));
});

test("STU-ERR-2: 跨班 task instance 访问", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  // B 班实例 — alex 在 A 班
  await page.goto(`${BASE}/tasks/00000000-0000-4000-8000-00000000b601`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/61-task-other-class.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("跨班任务访问:", body.slice(0, 1500));

  // API 直接探测
  const apiResp = await page.evaluate(async () => {
    const r = await fetch("/api/lms/task-instances/00000000-0000-4000-8000-00000000b601");
    return { status: r.status, text: (await r.text()).slice(0, 400) };
  });
  console.log("跨班 API 反应:", JSON.stringify(apiResp));
});

test("STU-ERR-3: 提交 API 跨班", async ({ page }) => {
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/dashboard`);

  // 不真提交，只观察 API 反应。Use evaluate to call write APIs
  const sub = await page.evaluate(async () => {
    const r = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskInstanceId: "00000000-0000-4000-8000-00000000b601",
        taskType: "quiz",
        answers: [],
      }),
    });
    return { status: r.status, text: (await r.text()).slice(0, 400) };
  });
  console.log("跨班 submission POST:", JSON.stringify(sub));
});
