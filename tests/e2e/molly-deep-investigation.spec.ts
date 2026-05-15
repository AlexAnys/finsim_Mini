import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/molly-investigation";
const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";

async function login(page: Page, email: string, pwd: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pwd);
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(180_000);

test("molly: 教学上下文 tab + outline draft 入口", async ({ page }) => {
  await login(page, "molly@qq.com", "password123");
  await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle");

  // 点教学上下文 tab
  console.log("\n=== Clicking 教学上下文 tab ===");
  await page.getByText("教学上下文", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/06-context-tab.png`, fullPage: true });
  
  const bodyText = await page.locator("body").textContent();
  console.log("教学上下文 tab content (first 2500 chars):");
  console.log(bodyText?.slice(bodyText?.indexOf("教学上下文") ?? 0, (bodyText?.indexOf("教学上下文") ?? 0) + 2500));
  
  console.log("\n=== buttons after switching tab ===");
  const buttons = await page.locator("button").allTextContents();
  buttons.filter(b => b.trim()).slice(0, 50).forEach((b, i) => console.log(`  ${i}: ${b.slice(0, 80)}`));
});

test("molly: 编辑课程对话框", async ({ page }) => {
  await login(page, "molly@qq.com", "password123");
  await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle");

  console.log("\n=== Clicking 编辑课程 ===");
  await page.getByRole("button", { name: "编辑课程" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/07-edit-course-dialog.png`, fullPage: true });
  
  const bodyText = await page.locator("body").textContent();
  const idx = bodyText?.indexOf("编辑") ?? 0;
  console.log("编辑 dialog content (around 编辑):");
  console.log(bodyText?.slice(idx, idx + 2000));

  // 找有没有 outline draft editor
  console.log("\n=== Looking for outline draft / 章节 inputs ===");
  const inputs = await page.locator('input[type="text"], textarea, input:not([type])').all();
  console.log(`found ${inputs.length} editable inputs in dialog`);
  for (let i = 0; i < Math.min(inputs.length, 15); i++) {
    const val = await inputs[i].inputValue().catch(() => "?");
    const placeholder = await inputs[i].getAttribute("placeholder").catch(() => "?");
    console.log(`  input[${i}]: value="${val.slice(0,50)}" placeholder="${placeholder}"`);
  }
});

test("molly: 教学上下文 → 编辑草稿 入口", async ({ page }) => {
  await login(page, "molly@qq.com", "password123");
  await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle");
  
  await page.getByText("教学上下文", { exact: true }).first().click();
  await page.waitForTimeout(1500);

  console.log("\n=== Looking for draft editor buttons ===");
  // 找跟"编辑"+"草稿"相关的按钮
  const editButtons = await page.locator("button").filter({ hasText: /编辑|草稿|查看/ }).all();
  for (let i = 0; i < editButtons.length; i++) {
    const t = await editButtons[i].textContent();
    console.log(`  button[${i}]: "${t}"`);
  }

  // 试找 "编辑课程目录草稿" 或 "目录草稿"
  const editDraft = page.locator("button").filter({ hasText: /目录草稿|编辑课程目录/ });
  const count = await editDraft.count();
  console.log("matching draft buttons:", count);
  
  if (count > 0) {
    await editDraft.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/08-draft-editor-open.png`, fullPage: true });
    
    // 找章节 input + 测打字延迟
    const inputs = await page.locator('input[type="text"], input:not([type])').all();
    console.log(`\n=== draft editor inputs: ${inputs.length} ===`);
    
    // 测每个 input 输入延迟
    for (let i = 0; i < Math.min(inputs.length, 5); i++) {
      const val = await inputs[i].inputValue().catch(() => "?");
      const placeholder = await inputs[i].getAttribute("placeholder").catch(() => "?");
      console.log(`  input[${i}]: value="${val.slice(0,40)}" placeholder="${placeholder}"`);
      
      // 测打字延迟
      await inputs[i].focus();
      const text = "测试X";
      const timings: number[] = [];
      for (let j = 0; j < text.length; j++) {
        const t0 = Date.now();
        await inputs[i].type(text[j], { delay: 0 });
        const elapsed = Date.now() - t0;
        timings.push(elapsed);
      }
      console.log(`    keystroke timings (ms): [${timings.join(", ")}] avg=${(timings.reduce((a,b)=>a+b)/timings.length).toFixed(1)}`);
    }
    
    await page.screenshot({ path: `${SS}/09-after-typing-test.png`, fullPage: true });
  } else {
    console.log("没找到 编辑课程目录草稿 按钮，可能在不同的地方或需要先点开 source");
    // 看 source 列表
    await page.screenshot({ path: `${SS}/08-context-no-draft-btn.png`, fullPage: true });
    
    // 找跟 source 相关的按钮
    const sourceRow = page.locator("text=/个人理财|编码表|syllabus/i").first();
    if (await sourceRow.count() > 0) {
      console.log("找到 source row，试点击");
      await sourceRow.click().catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/08b-source-clicked.png`, fullPage: true });
    }
  }
});
