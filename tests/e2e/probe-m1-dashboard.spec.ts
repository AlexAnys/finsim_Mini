import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/probe-m1";

async function loginTeacher(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "teacher1@finsim.edu.cn");
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function loginStudent(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "student1@finsim.edu.cn");
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(240_000);

test("M1-1: 教师 dashboard 页面三类卡片渲染检查", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 250));
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 250)}`));

  await loginTeacher(page);
  await page.screenshot({ path: `${SS}/01-after-login.png`, fullPage: true });
  console.log("after login url:", page.url());

  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/02-dashboard.png`, fullPage: true });

  // 检查标题
  const hasTeachWorkbench = await page.getByText("教学工作台").count();
  console.log("有「教学工作台」标题:", hasTeachWorkbench);

  // 检查关键模块文案
  const moduleTexts = [
    "教学工作台",      // 标题
    "AI 助手",         // 顶部 chip
    "一周洞察",        // 按钮
    "今日",            // KPI hint
    "待批",
    "本周新发布",
  ];
  for (const t of moduleTexts) {
    const c = await page.getByText(t).count();
    console.log(`  Text「${t}」count =`, c);
  }

  // 卡片 / Section 标题
  const sectionTitles = [
    "任务进度",          // AttentionList (任务时间线 / 任务实例 / 课程任务)
    "班级表现",          // PerformanceChart
    "薄弱任务",          // WeakInstances
    "今日课表",          // TodaySchedule
    "近期课表",
    "动态",              // ActivityFeed
    "学生提交动态",
  ];
  for (const t of sectionTitles) {
    const c = await page.getByText(t).count();
    console.log(`  Section「${t}」count =`, c);
  }

  // 收集所有 h1, h2, h3 文字
  console.log("\n=== Headers ===");
  const headers = await page.locator("h1, h2, h3").allTextContents();
  headers.forEach((h, i) => console.log(`  H[${i}]: ${h?.slice(0, 80)}`));

  console.log("\n=== Console errors ===");
  consoleErrors.forEach((e, i) => console.log(`  [${i}]:`, e));
});

test("M1-2: 一周洞察按钮可发现 + 点击触发流程", async ({ page }) => {
  const consoleErrors: string[] = [];
  const networkLog: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 250));
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 250)}`));
  page.on("response", (resp) => {
    const u = resp.url();
    if (u.includes("/api/lms/weekly-insight") || u.includes("/api/lms/dashboard")) {
      networkLog.push(`${resp.status()} ${u}`);
    }
  });

  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${SS}/03-dashboard-before-click.png`, fullPage: true });

  // 找按钮 — aria-label="生成一周洞察"
  const btn = page.getByRole("button", { name: "生成一周洞察" });
  const btnVisible = await btn.isVisible().catch(() => false);
  console.log("「生成一周洞察」按钮可见:", btnVisible);

  if (!btnVisible) {
    console.log("找不到按钮 — 检查可见按钮列表");
    const buttons = await page.locator("button, a").allTextContents();
    buttons.slice(0, 20).forEach((b, i) => console.log(`  btn[${i}]: ${b?.slice(0, 60)}`));
    return;
  }

  const startTs = Date.now();
  await btn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SS}/04-after-click-loading.png`, fullPage: true });

  // 等待 modal 出现 + AI 返回（最多 90s）
  await page.waitForSelector("text=/正在生成|本周亮点摘要|时间窗口/", { timeout: 90_000 }).catch(() => {
    console.log("等待 modal 内容超时（90s）");
  });

  // 等到 loading 消失（出现 "本周亮点摘要" 或 error）
  await page
    .waitForSelector(
      "text=/本周亮点摘要|生成洞察失败|网络错误|本周尚无|本周洞察 AI 服务/",
      { timeout: 90_000 }
    )
    .catch(() => console.log("等待 AI 结果超时（90s）"));

  const took = Date.now() - startTs;
  console.log("点击→结果耗时:", took, "ms");

  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SS}/05-modal-result.png`, fullPage: true });

  // 收集 modal 全文
  const modalText = await page.locator('[role="dialog"]').textContent().catch(() => null);
  console.log("\n=== Modal text (first 2000 chars) ===");
  console.log(modalText?.slice(0, 2000));

  console.log("\n=== Network log ===");
  networkLog.forEach((n) => console.log("  ", n));

  console.log("\n=== Console errors ===");
  consoleErrors.forEach((e, i) => console.log(`  [${i}]:`, e));
});

test("M1-3: API 直调 — 教师 weekly-insight + dashboard summary", async ({ page }) => {
  await loginTeacher(page);

  // dashboard summary
  const dashboardRes = await page.request.get(`${BASE}/api/lms/dashboard/summary`);
  console.log("\n=== /api/lms/dashboard/summary ===");
  console.log("  status:", dashboardRes.status());
  const dashboardJson = await dashboardRes.json();
  console.log("  success:", dashboardJson.success);
  if (dashboardJson.success) {
    const d = dashboardJson.data;
    console.log("    courses:", d.courses?.length);
    console.log("    taskInstances:", d.taskInstances?.length);
    console.log("    recentSubmissions:", d.recentSubmissions?.length);
    console.log("    scheduleSlots:", d.scheduleSlots?.length);
    console.log("    stats:", JSON.stringify(d.stats));

    // recentSubmissions 样本
    if (d.recentSubmissions?.length) {
      console.log("    Sample recentSubmission:", JSON.stringify(d.recentSubmissions[0]).slice(0, 300));
    }
  } else {
    console.log("  error:", JSON.stringify(dashboardJson.error));
  }

  // weekly insight 第一次（用 cache or 重新生成）
  console.log("\n=== /api/lms/weekly-insight (first call) ===");
  const t1 = Date.now();
  const weeklyRes = await page.request.get(`${BASE}/api/lms/weekly-insight`);
  const ms1 = Date.now() - t1;
  console.log("  status:", weeklyRes.status(), "time:", ms1, "ms");
  const weeklyJson = await weeklyRes.json();
  console.log("  success:", weeklyJson.success);
  if (weeklyJson.success) {
    const d = weeklyJson.data;
    console.log("    cached:", d.cached);
    console.log("    submissionCount:", d.submissionCount);
    console.log("    windowStart:", d.windowStart);
    console.log("    windowEnd:", d.windowEnd);
    console.log("    weakConceptsByCourse:", d.payload?.weakConceptsByCourse?.length);
    console.log("    classDifferences:", d.payload?.classDifferences?.length);
    console.log("    studentClusters:", d.payload?.studentClusters?.length);
    console.log("    upcomingClassRecommendations:", d.payload?.upcomingClassRecommendations?.length);
    console.log("    highlightSummary:", d.payload?.highlightSummary?.slice(0, 300));
  } else {
    console.log("  error:", JSON.stringify(weeklyJson.error));
  }

  // weekly insight 第二次（应 cached）
  console.log("\n=== /api/lms/weekly-insight (second call, expect cache) ===");
  const t2 = Date.now();
  const weeklyRes2 = await page.request.get(`${BASE}/api/lms/weekly-insight`);
  const ms2 = Date.now() - t2;
  console.log("  status:", weeklyRes2.status(), "time:", ms2, "ms");
  const weeklyJson2 = await weeklyRes2.json();
  console.log("  cached:", weeklyJson2.data?.cached);

  // weekly insight force=true
  console.log("\n=== /api/lms/weekly-insight?force=true ===");
  const t3 = Date.now();
  const weeklyRes3 = await page.request.get(`${BASE}/api/lms/weekly-insight?force=true`);
  const ms3 = Date.now() - t3;
  console.log("  status:", weeklyRes3.status(), "time:", ms3, "ms");
  const weeklyJson3 = await weeklyRes3.json();
  console.log("  cached:", weeklyJson3.data?.cached);
  console.log("  submissionCount:", weeklyJson3.data?.submissionCount);
});

test("M1-4: 学生权限 — student 调 weekly-insight 应 403", async ({ page }) => {
  await loginStudent(page);
  const res = await page.request.get(`${BASE}/api/lms/weekly-insight`);
  console.log("\n=== student call /api/lms/weekly-insight ===");
  console.log("  status:", res.status());
  const json = await res.json();
  console.log("  json:", JSON.stringify(json).slice(0, 300));
});
