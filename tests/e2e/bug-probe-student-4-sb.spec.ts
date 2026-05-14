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

test("STU-SB-1: Study Buddy 主页 + 新建提问 dialog", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/study-buddy`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${SS}/30-study-buddy-list.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("STUDY-BUDDY 主页文本 (2000 字符):", body.slice(0, 2000));

  // 现存 post 数量
  const postCards = page.locator('[role="button"], button, a').filter({ hasText: /测试|理财|资产|风险/ });
  console.log("可能 post card 数:", await postCards.count());

  // 新建 / 提问 按钮
  const newBtn = page.locator("button").filter({ hasText: /提问|新建|新提问|开始/ });
  const newCnt = await newBtn.count();
  console.log("新建提问 按钮数:", newCnt);

  if (newCnt > 0) {
    await newBtn.first().click();
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: `${SS}/31-study-buddy-new-dialog.png`, fullPage: true });
    const dialogBody = await page.locator("body").innerText();
    console.log("DIALOG 文本 (1500):", dialogBody.slice(0, 1500));

    // 必填项检测 — 任务选择是否必选 / 自由问课程
    const taskSelectors = await page
      .locator("text=/选择任务|关联任务|相关任务|任务/")
      .count();
    console.log("dialog 中 任务相关文案:", taskSelectors);
    const courseSelectors = await page
      .locator("text=/选择课程|关联课程|相关课程|课程/")
      .count();
    console.log("dialog 中 课程相关文案:", courseSelectors);
    const chapterSelectors = await page
      .locator("text=/选择章节|关联章节|章节/")
      .count();
    console.log("dialog 中 章节相关文案:", chapterSelectors);

    // select 元素
    const selects = page.locator('select, [role="combobox"], button[role="combobox"]');
    console.log("dialog 中 select/combobox 数:", await selects.count());

    // 关掉对话框
    const closeBtn = page.locator('button[aria-label*="关闭"], button[aria-label*="Close"]');
    if ((await closeBtn.count()) > 0) await closeBtn.first().click().catch(() => {});
  }

  // 现存 post 详情 — 直接进入 alex 的 1 条 answered post
  const ans = await page.evaluate(async () => {
    const r = await fetch("/api/study-buddy/posts");
    const j = await r.json();
    return { status: r.status, data: j };
  });
  console.log(
    "STUDY-BUDDY GET /api/study-buddy/posts:",
    JSON.stringify(ans).slice(0, 1500),
  );

  console.log("STU-SB-1 CONSOLE ERRORS:", consoleErrors.slice(0, 10));
});

test("STU-SB-2: 点开现有 post 详情", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/study-buddy`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000);

  // 找现存 post 的 card 点击
  const allCardClicks = page.locator("[data-post-id], article, [data-buddy-post]");
  let clicked = false;
  if ((await allCardClicks.count()) > 0) {
    await allCardClicks.first().click().catch(() => {});
    clicked = true;
  } else {
    // 退而求其次，找包含 "测试" 字样的可点元素
    const fallback = page.locator("button, a, [role='button']").filter({ hasText: /测试|理财|配置|风险/ });
    const fc = await fallback.count();
    console.log("fallback 可点 post 元素:", fc);
    if (fc > 0) {
      await fallback.first().click().catch(() => {});
      clicked = true;
    }
  }
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: `${SS}/32-sb-post-detail.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("SB POST 详情:", body.slice(0, 2000));
  console.log("是否成功点开 post:", clicked);

  // 检查素材引用 / contextSources
  const refLabels = await page.locator("text=/参考|引用|素材|来源/").count();
  console.log("SB post 参考/引用文案数:", refLabels);

  console.log("STU-SB-2 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("STU-SIM-2: 模拟对话 fullscreen 页面探索", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));
  await login(page, "alex@qq.com", "11");

  // 进入 sim 页面
  await page.goto(`${BASE}/sim/00000000-0000-4000-8000-00000000a602`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(4_000);
  await page.screenshot({ path: `${SS}/40-sim-fullscreen.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("SIM 全屏页 (2500 字符):", body.slice(0, 2500));

  // 元素：背景情景 / 评分对照 / 客户消息 / 输入框 / 发送按钮 / 语音按钮 / 资产配置按钮
  console.log("背景情景文案:", await page.locator("text=/背景情景|场景背景/").count());
  console.log("评分对照文案:", await page.locator("text=/评分对照|评分指引|评分参考/").count());
  console.log("情绪条文案:", await page.locator("text=/客户情绪|犹豫|焦虑|平静/").count());

  const sendBtn = page.locator("button").filter({ hasText: /^发送$/ });
  console.log("发送按钮:", await sendBtn.count());

  const voiceBtn = page.locator("button").filter({ hasText: /语音/ });
  console.log("语音按钮:", await voiceBtn.count());

  const textarea = page.locator("textarea, [contenteditable=true]");
  console.log("输入框:", await textarea.count());

  // 资产配置按钮
  const assetBtn = page.locator("button").filter({ hasText: /资产配置|为客户配资产/ });
  console.log("资产配置按钮:", await assetBtn.count());

  // 结束对话 / 重来按钮
  const endBtn = page.locator("button").filter({ hasText: /结束对话/ });
  const restartBtn = page.locator("button").filter({ hasText: /重来|重新开始/ });
  console.log("结束对话按钮:", await endBtn.count());
  console.log("重来按钮:", await restartBtn.count());

  console.log("STU-SIM-2 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});
