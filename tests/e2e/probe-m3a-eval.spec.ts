import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/probe-m3a";

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(300_000);

test("M3a-EVAL: 教师 preview 模式跑完一轮 + 评估出分", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "teacher1@finsim.edu.cn");

  const tasksRes = await page.request.get(`${BASE}/api/lms/task-instances?role=teacher`);
  const tasksJson = await tasksRes.json();
  const simInst = (tasksJson.data || []).find((i: any) => i.taskType === "simulation");
  if (!simInst) { console.log("NO SIM"); return; }
  console.log("PREVIEW INSTANCE:", simInst.id);

  await page.goto(`${BASE}/sim/${simInst.id}?preview=true`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // 多轮对话
  for (let i = 1; i <= 2; i++) {
    const ta = page.locator('textarea').first();
    await ta.fill(`您好。听到您想买高收益产品（第${i}轮）。先了解一下：您目前的家庭月支出大概多少？孩子的教育金您打算几年内用？这些信息帮我评估合适的产品类型。`);
    await ta.press('Enter');
    await page.waitForTimeout(5500);
  }
  await page.screenshot({ path: `${SS}/60-preview-after-chat.png`, fullPage: true });

  // 结束对话
  const finishBtn = page.getByRole('button', { name: /结束对话/i }).first();
  await finishBtn.click();
  await page.waitForTimeout(15000); // wait for AI eval
  await page.screenshot({ path: `${SS}/61-preview-eval.png`, fullPage: true });

  // 检查评估页面元素
  const text = await page.locator("body").innerText();
  console.log("HAS 总分:", text.includes("总分") || text.includes("综合评语"));
  console.log("HAS 单项得分:", text.includes("单项得分"));
  console.log("HAS 完整对话记录:", text.includes("完整对话记录"));
  console.log("HAS 综合评语:", text.includes("综合评语"));

  // 拿 rubric breakdown text 看一下质量
  const rubricRegion = await page.locator("text=单项得分").locator("..").locator("..").innerText().catch(() => "");
  console.log("RUBRIC TEXT (first 800):", rubricRegion.slice(0, 800));

  console.log("CONSOLE ERRORS:", consoleErrors.slice(0, 5));
});
