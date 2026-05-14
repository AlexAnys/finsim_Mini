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

test("STU-1: 学生 dashboard 完整性", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: `${SS}/01-dashboard.png`, fullPage: true });

  const bodyText = await page.locator("body").innerText();
  console.log("DASHBOARD TEXT SAMPLE:", bodyText.slice(0, 1500));

  // 关键 KPI / 卡片可见性
  const kpiLabels = ["本周待办", "本周完成", "平均得分", "已完成率"];
  for (const label of kpiLabels) {
    const c = await page.getByText(label).count();
    console.log(`KPI 标签 [${label}] 命中数:`, c);
  }

  // 任务卡（PriorityTasks）
  const priorityHeader = await page.locator("text=优先任务").count();
  console.log("优先任务卡 header 命中:", priorityHeader);
  const overdueBadge = await page.locator("text=/已过期|逾期/").count();
  console.log("过期 badge 命中:", overdueBadge);

  // 近期成绩
  const recentHeader = await page.locator("text=/近期成绩|最近成绩/").count();
  console.log("近期成绩卡 header 命中:", recentHeader);

  // AI 助教 callout
  const aiCallout = await page.locator("text=/AI 助|学伴|学习助手/").count();
  console.log("AI 助教 callout 命中:", aiCallout);

  console.log("STU-1 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("STU-2: /tasks 路由 + 我的全部任务列表入口", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });

  await login(page, "alex@qq.com", "11");

  // 直接访问 /tasks
  await page.goto(`${BASE}/tasks`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/02-tasks-route.png`, fullPage: true });
  const tasksUrl = page.url();
  const tasksBody = await page.locator("body").innerText();
  console.log("/tasks final URL:", tasksUrl);
  console.log("/tasks body 头部 600 字符:", tasksBody.slice(0, 600));
  const is404 = /404|找不到|不存在|页面错误/.test(tasksBody);
  console.log("/tasks 是否 404:", is404);

  // 找 sidebar 是否有 /tasks 链接
  const sidebarTasksLink = await page.locator('a[href="/tasks"], a[href$="/tasks"]').count();
  console.log("sidebar 有 /tasks 链接:", sidebarTasksLink);

  // dashboard 是否能跳转到完整任务列表
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  const allTasksLink = await page
    .locator("text=/查看全部|所有任务|我的全部任务|全部任务/")
    .count();
  console.log("dashboard 有 查看全部 入口:", allTasksLink);

  console.log("STU-2 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("STU-3: 我的课程 + 我的成绩 + 课表", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });

  await login(page, "alex@qq.com", "11");

  // /courses
  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/03-courses.png`, fullPage: true });
  const coursesBody = await page.locator("body").innerText();
  console.log("/courses 头部:", coursesBody.slice(0, 500));

  // /grades
  await page.goto(`${BASE}/grades`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/04-grades.png`, fullPage: true });
  const gradesBody = await page.locator("body").innerText();
  console.log("/grades 头部:", gradesBody.slice(0, 500));

  // /schedule
  await page.goto(`${BASE}/schedule`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/05-schedule.png`, fullPage: true });
  const scheduleBody = await page.locator("body").innerText();
  console.log("/schedule 头部:", scheduleBody.slice(0, 500));

  console.log("STU-3 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("STU-4: 课程详情 + 课程内任务入口", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });

  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");

  // 点第一个课程
  const cardLink = page.locator('a[href*="/courses/"]').first();
  if ((await cardLink.count()) > 0) {
    await cardLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: `${SS}/06-course-detail.png`, fullPage: true });
    const detailBody = await page.locator("body").innerText();
    console.log("课程详情 头部:", detailBody.slice(0, 1000));
  }

  console.log("STU-4 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});
