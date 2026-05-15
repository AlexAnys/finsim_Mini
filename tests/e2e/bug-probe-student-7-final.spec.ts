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

test("STU-MOBILE-1: dashboard 移动端布局", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/70-mobile-dashboard.png`, fullPage: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  console.log("移动端 dashboard 错误:", errors.slice(0, 5));

  // 任务列表 mobile
  await page.goto(`${BASE}/sim/00000000-0000-4000-8000-00000000a602`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${SS}/71-mobile-sim.png`, fullPage: true });

  await context.close();
});

test("STU-NAV-1: sidebar 路由是否全活", async ({ page }) => {
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");

  const links = await page.locator('aside a, nav a').evaluateAll((els) =>
    els.map((el) => ({
      href: (el as HTMLAnchorElement).getAttribute("href") || "",
      text: (el.textContent || "").trim().slice(0, 50),
    })),
  );
  console.log("sidebar 链接:", JSON.stringify(links.slice(0, 25), null, 2));

  // 学生应该看到的 / 看不到的
  const allHrefs = links.map((l) => l.href);
  console.log("学生 sidebar 含 /teacher 路由?", allHrefs.some((h) => h.includes("/teacher")));
  console.log("学生 sidebar 含 /study-buddy?", allHrefs.includes("/study-buddy"));
  console.log("学生 sidebar 含 /tasks?", allHrefs.includes("/tasks"));
});

test("STU-ATT-1: 主观题草稿 + 字符上限", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  // 7天后截止的（d8099300）— not overdue
  await page.goto(`${BASE}/tasks/d8099300-e7ff-4aac-8505-b3533a82fd39`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/72-subj-not-overdue.png`, fullPage: true });

  // 输入超长文本看是否有 wordLimit
  const ta = page.locator("textarea").first();
  if ((await ta.count()) > 0) {
    const longText = "这是一段测试文本。".repeat(200); // ~2400 字
    await ta.fill(longText);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SS}/73-subj-long-text.png`, fullPage: true });
    const charCounter = await page.locator("text=/字\\s*\\d+|\\d+\\s*字|字数/").allInnerTexts();
    console.log("字数计数:", charCounter);

    // 检查"存草稿"和"提交"按钮是否存在
    const draftBtn = page.locator("button").filter({ hasText: /存草稿|保存草稿/ });
    const submitBtn = page.locator("button").filter({ hasText: /^提交$/ });
    console.log("存草稿 btn:", await draftBtn.count(), "提交 btn:", await submitBtn.count());

    // 不提交，仅截图当前状态
  }

  console.log("STU-ATT-1 CONSOLE ERRORS:", consoleErrors.slice(0, 5));
});

test("STU-QUIZ-DETAIL: 测验进入答题流程并查看每题选项", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  // 449ae28c — 个人理财基础概念测验（fixed mode, 8q）
  await page.goto(`${BASE}/tasks/449ae28c-8913-43f5-adda-dc296885071b`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/74-quiz-fixed-entry.png`, fullPage: true });

  const startBtn = page.locator("button").filter({ hasText: /开始/ }).first();
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: `${SS}/75-quiz-fixed-q1.png`, fullPage: true });
    const body = await page.locator("body").innerText();
    console.log("FIXED QUIZ Q1 (2000):", body.slice(0, 2000));

    // 选项渲染检查
    const radios = page.getByRole("radio");
    console.log("题目1 radio 数:", await radios.count());
    if ((await radios.count()) > 0) {
      const firstOpt = radios.first();
      await firstOpt.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SS}/76-quiz-q1-selected.png`, fullPage: true });

      // 看是否提交后即时反馈（fixed mode 应该不显示）
      const confirmBtn = page.locator("button").filter({ hasText: /确认答案/ });
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.first().click();
        await page.waitForTimeout(1_500);
        await page.screenshot({ path: `${SS}/77-quiz-confirmed.png`, fullPage: true });
        const afterBody = await page.locator("body").innerText();
        console.log("CONFIRM 后 (1500):", afterBody.slice(0, 1500));
        // fixed 模式应该不显示正确答案
        const correctShown = await page.locator("text=/正确答案|解析/").count();
        console.log("点击确认后是否显示正确答案/解析:", correctShown);
      }
    }
  }
  console.log("STU-QUIZ-DETAIL CONSOLE ERRORS:", consoleErrors.slice(0, 5));
});

test("STU-SCHED-DETAIL: 课表点击 + 跳转课程", async ({ page }) => {
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/schedule`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/78-schedule-detail.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("SCHEDULE PAGE (2500):", body.slice(0, 2500));

  // 周课表卡
  const weekBtn = page.locator("button").filter({ hasText: /本周|周课表|日历/ });
  console.log("时间切换按钮数:", await weekBtn.count());

  // 切到日历
  const calBtn = page.locator("button").filter({ hasText: /^日历$/ });
  if ((await calBtn.count()) > 0) {
    await calBtn.click();
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: `${SS}/79-schedule-calendar.png`, fullPage: true });
  }
});
