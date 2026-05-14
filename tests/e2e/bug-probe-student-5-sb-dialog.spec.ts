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

test("STU-SB-DIALOG: 打开新问题 dialog 完整字段 / 必填检查", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/study-buddy`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);

  const newBtn = page.getByRole("button", { name: /新问题/ });
  console.log("新问题 button 可见:", await newBtn.isVisible().catch(() => false));
  await newBtn.click();
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${SS}/41-sb-dialog-open.png`, fullPage: true });

  const dialogBody = await page.locator("body").innerText();
  console.log("DIALOG TEXT (2000):", dialogBody.slice(0, 2000));

  // 课程选择
  const courseSelectBtn = page.locator('button[role="combobox"]');
  console.log("combobox 数:", await courseSelectBtn.count());

  // 选择课程下拉
  if ((await courseSelectBtn.count()) >= 1) {
    await courseSelectBtn.nth(0).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/42-sb-course-options.png`, fullPage: true });
    const courseOpts = page.locator('[role="option"]');
    console.log("课程选项数:", await courseOpts.count());
    if ((await courseOpts.count()) > 0) {
      const titles = await courseOpts.allInnerTexts();
      console.log("课程选项:", titles);
    }
    // 关闭
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // 任务选择 — 看 select 是否被强制
  if ((await courseSelectBtn.count()) >= 3) {
    await courseSelectBtn.nth(2).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/43-sb-task-options.png`, fullPage: true });
    const taskOpts = page.locator('[role="option"]');
    console.log("任务选项数:", await taskOpts.count());
    if ((await taskOpts.count()) > 0) {
      const titles = await taskOpts.allInnerTexts();
      console.log("任务选项 (前 10):", titles.slice(0, 10));
    }
    await page.keyboard.press("Escape");
  }

  // 找发起对话按钮，看初始 disable 状态
  const submitBtn = page.getByRole("button", { name: /发起对话/ });
  console.log("发起对话按钮 disabled:", await submitBtn.isDisabled());

  // 仅输入标题/问题，不选任务 — 看是否能提交
  await page.locator('input[placeholder*="一句话"]').fill("我能不能自由提问？");
  await page.locator('textarea').fill("这是一条不选任务的测试问题，我想了解能否不挂任务直接问。");
  await page.waitForTimeout(500);
  console.log("仅文字内容不选任务，发起对话按钮 disabled:", await submitBtn.isDisabled());

  // 匿名 toggle
  const switches = page.locator('[role="switch"]');
  console.log("匿名 switch 数:", await switches.count());

  // 模式按钮
  const modeButtons = page.locator('button[aria-pressed]');
  console.log("模式按钮（aria-pressed）数:", await modeButtons.count());

  console.log("STU-SB-DIALOG CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("STU-SB-API: POST /api/study-buddy/posts 无 taskId 拒绝", async ({ page }) => {
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");

  const noTaskAttempt = await page.evaluate(async () => {
    const r = await fetch("/api/study-buddy/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "测试无关联任务",
        question: "能不能不挂任务？",
        mode: "direct",
        anonymous: false,
      }),
    });
    return { status: r.status, text: (await r.text()).slice(0, 400) };
  });
  console.log("无 taskId POST 反应:", JSON.stringify(noTaskAttempt));

  // 跨班 task instance
  const crossClassAttempt = await page.evaluate(async () => {
    const r = await fetch("/api/study-buddy/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "跨班尝试",
        question: "我不在 B 班",
        mode: "direct",
        anonymous: false,
        taskInstanceId: "00000000-0000-4000-8000-00000000b601",
      }),
    });
    return { status: r.status, text: (await r.text()).slice(0, 400) };
  });
  console.log("跨班 taskInstanceId POST 反应:", JSON.stringify(crossClassAttempt));
});
