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

test.setTimeout(180_000);

test("M1-detail-1: 仪表盘 — 课程任务 / 课表 / 学生提交动态 三类卡片实测", async ({ page }) => {
  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);

  // 截大图
  await page.screenshot({ path: `${SS}/06-dashboard-full.png`, fullPage: true });

  // 提取「任务列表」卡片实际内容（AttentionList）
  const attListHandle = page.locator("text=/^任务列表/").first();
  if (await attListHandle.count()) {
    // 取父 section
    const section = attListHandle.locator("xpath=ancestor::section[1]");
    const sectionText = await section.first().textContent().catch(() => null);
    console.log("\n=== 任务列表卡片文本（first 800） ===");
    console.log(sectionText?.slice(0, 800));
  } else {
    console.log("找不到「任务列表」标题");
  }

  // 提取「近期课表」
  const schedHandle = page.locator("text=/^近期课表/").first();
  if (await schedHandle.count()) {
    const section = schedHandle.locator("xpath=ancestor::section[1]");
    const t = await section.first().textContent().catch(() => null);
    console.log("\n=== 近期课表文本（first 600） ===");
    console.log(t?.slice(0, 600));
  }

  // 提取「动态」(ActivityFeed)
  const actHandle = page.locator("text=/^动态/").first();
  if (await actHandle.count()) {
    const section = actHandle.locator("xpath=ancestor::section[1]");
    const t = await section.first().textContent().catch(() => null);
    console.log("\n=== 动态卡片文本（first 600） ===");
    console.log(t?.slice(0, 600));
  }

  // 班级表现
  const perfHandle = page.locator("text=/^班级表现/").first();
  if (await perfHandle.count()) {
    const section = perfHandle.locator("xpath=ancestor::section[1]");
    const t = await section.first().textContent().catch(() => null);
    console.log("\n=== 班级表现卡片文本（first 600） ===");
    console.log(t?.slice(0, 600));
  }

  // 薄弱任务
  const weakHandle = page.locator("text=/^薄弱任务/").first();
  if (await weakHandle.count()) {
    const section = weakHandle.locator("xpath=ancestor::section[1]");
    const t = await section.first().textContent().catch(() => null);
    console.log("\n=== 薄弱任务卡片文本（first 600） ===");
    console.log(t?.slice(0, 600));
  }
});

test("M1-detail-2: 仪表盘窗口尺寸 — 移动端 vs 桌面", async ({ page }) => {
  // 桌面端
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/07-dashboard-desktop-1440.png`, fullPage: true });

  // 移动端
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SS}/08-dashboard-mobile-375.png`, fullPage: true });
});

test("M1-detail-3: 一周洞察 modal — 关闭 + 重新生成按钮行为", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 250));
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 250)}`));

  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  // 点开 modal
  const btn = page.getByRole("button", { name: "生成一周洞察" });
  await btn.click();

  // 等结果（缓存命中应快）
  await page
    .waitForSelector(
      "text=/本周亮点摘要|生成洞察失败|网络错误|本周尚无|本周洞察 AI 服务/",
      { timeout: 60_000 }
    )
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SS}/09-modal-cached.png`, fullPage: true });

  // 「重新生成」按钮
  const regenBtn = page.getByRole("button", { name: "重新生成" });
  const regenVisible = await regenBtn.isVisible().catch(() => false);
  console.log("「重新生成」按钮可见:", regenVisible);

  if (regenVisible) {
    const t0 = Date.now();
    await regenBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/10-modal-regenerating.png`, fullPage: true });
    // 等新结果
    await page
      .waitForSelector("text=/本周亮点摘要|生成洞察失败|网络错误/", { timeout: 60_000 })
      .catch(() => {});
    const took = Date.now() - t0;
    console.log("「重新生成」耗时:", took, "ms");
    await page.screenshot({ path: `${SS}/11-modal-regenerated.png`, fullPage: true });
  }

  // 关闭按钮
  await page.getByRole("button", { name: "关闭" }).click();
  await page.waitForTimeout(400);
  const dialogStillOpen = await page.locator('[role="dialog"]').count();
  console.log("关闭后 dialog 数:", dialogStillOpen);
  await page.screenshot({ path: `${SS}/12-modal-closed.png`, fullPage: true });

  console.log("\n=== Console errors ===");
  consoleErrors.forEach((e, i) => console.log(`  [${i}]:`, e));
});
