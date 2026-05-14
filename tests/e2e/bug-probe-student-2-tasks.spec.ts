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

// alex 班级有 22 个 TaskInstance（DB 查询确认）
// simulation: 2e700d5e-fa7e-4f13-b000-03f660414b89 / da3724bf-cdb5-43c4-b8a4-2849ac97f191
// quiz: 449ae28c-8913-43f5-adda-dc296885071b / 00000000-0000-4000-8000-00000000a601
// subjective: a5d8f119-e3cd-426f-8ea9-e57f77608ffe / 00000000-0000-4000-8000-00000000a603 (deadlines in future)

const SIM_ID = "00000000-0000-4000-8000-00000000a602"; // ANL-2 客户风险评估模拟 future deadline
const QUIZ_ID = "00000000-0000-4000-8000-00000000a601"; // ANL-2 复利测验 future deadline
const SUBJ_ID = "00000000-0000-4000-8000-00000000a603"; // ANL-2 资产配置简答 future deadline

test("STU-SIM-1: 模拟对话入口 + 预览页 + 进入对话页", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks/${SIM_ID}`);
  // 应该 redirect 到 /sim/...
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
  console.log("SIM final URL:", page.url());
  await page.screenshot({ path: `${SS}/10-sim-preview.png`, fullPage: true });

  const body = await page.locator("body").innerText();
  console.log("SIM 页面文本 (1000 字符):", body.slice(0, 1000));
  console.log("SIM CONSOLE ERRORS:", consoleErrors.slice(0, 8));

  // 找进入对话的按钮
  const startBtn = page.locator("button").filter({
    hasText: /开始|进入|继续|开始对话|开始模拟/,
  });
  const startCount = await startBtn.count();
  console.log("SIM 开始按钮数:", startCount);
  if (startCount > 0) {
    const txt = await startBtn.first().innerText();
    console.log("SIM 开始按钮文案:", txt.slice(0, 60));
  }
});

test("STU-QUIZ-1: 测验入口 + 题目渲染 + adaptive 模式", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks/${QUIZ_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${SS}/11-quiz-entry.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("QUIZ 页面文本 (1500 字符):", body.slice(0, 1500));
  console.log("QUIZ CONSOLE ERRORS:", consoleErrors.slice(0, 8));

  // 寻找题干 / 选项 / "开始答题"
  const startBtn = page.locator("button").filter({ hasText: /开始|开始答题/ });
  const startCnt = await startBtn.count();
  console.log("QUIZ 开始答题按钮数:", startCnt);

  // 模式标签
  const adaptiveText = await page.locator("text=/自适应|adaptive|练习模式/i").count();
  const examText = await page.locator("text=/考试|exam/i").count();
  console.log("QUIZ 模式 — adaptive/练习:", adaptiveText, "exam:", examText);

  if (startCnt > 0) {
    await startBtn.first().click();
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: `${SS}/12-quiz-question.png`, fullPage: true });
    const qBody = await page.locator("body").innerText();
    console.log("QUIZ 题目页 (1500 字符):", qBody.slice(0, 1500));
    // 选项数
    const optionCnt = await page.locator('[role="radio"], input[type="radio"], button:has-text("A")').count();
    console.log("QUIZ 选项元素数:", optionCnt);
  }
});

test("STU-SUBJ-1: 主观题入口 + 附件 UI + capture 属性", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks/${SUBJ_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${SS}/13-subj-entry.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("SUBJ 页面文本 (1500 字符):", body.slice(0, 1500));
  console.log("SUBJ CONSOLE ERRORS:", consoleErrors.slice(0, 8));

  // 附件上传 input
  const fileInput = page.locator('input[type="file"]');
  const inputCnt = await fileInput.count();
  console.log("SUBJ file input 数量:", inputCnt);
  if (inputCnt > 0) {
    for (let i = 0; i < inputCnt; i++) {
      const inp = fileInput.nth(i);
      const accept = await inp.getAttribute("accept");
      const capture = await inp.getAttribute("capture");
      const multiple = await inp.getAttribute("multiple");
      console.log(`SUBJ file input[${i}] accept=${accept} capture=${capture} multiple=${multiple}`);
    }
  }

  // 拍照按钮
  const cameraBtn = page.locator("button").filter({ hasText: /拍照|相机|camera/i });
  console.log("SUBJ 拍照按钮数量:", await cameraBtn.count());

  // 文字答题区
  const textArea = page.locator('textarea, [contenteditable="true"]');
  console.log("SUBJ 文字答题区数量:", await textArea.count());

  // 量规 / scoring criteria
  const rubricLabels = await page.locator("text=/评分标准|量规|得分点/").count();
  console.log("SUBJ 量规相关文案数:", rubricLabels);
});
