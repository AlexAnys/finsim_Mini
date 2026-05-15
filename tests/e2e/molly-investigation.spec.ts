import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/molly-investigation";

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

test("molly: investigate course edit page", async ({ page }) => {
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") console.log(`[browser ${t}]`, msg.text().slice(0, 200));
  });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message.slice(0, 200)));

  await login(page, "molly@qq.com", "password123");
  await page.screenshot({ path: `${SS}/01-after-login.png`, fullPage: true });

  // 进入课程管理
  await page.goto(`${BASE}/teacher/courses`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/02-courses-list.png`, fullPage: true });
  console.log("courses url:", page.url());

  // 进入「个人规划」课程编辑
  const courseId = "8f7f653c-9177-44f6-b764-80f7f779b2ef";
  await page.goto(`${BASE}/teacher/courses/${courseId}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/03-course-detail.png`, fullPage: true });

  // 看 knowledge source 状态
  const ksText = await page.locator("body").textContent();
  console.log("\n=== Course Detail Page (first 1500 chars) ===");
  console.log(ksText?.slice(0, 1500));

  // 找编辑大纲入口 - 看 page HTML 找按钮
  console.log("\n=== Buttons/clickable elements ===");
  const buttons = await page.locator("button, [role='button'], a").allTextContents();
  buttons.slice(0, 30).forEach((b, i) => console.log(`  ${i}: ${b?.slice(0, 60)}`));
});

test("molly: outline editor input lag investigation", async ({ page }) => {
  await login(page, "molly@qq.com", "password123");
  
  const courseId = "8f7f653c-9177-44f6-b764-80f7f779b2ef";
  await page.goto(`${BASE}/teacher/courses/${courseId}`);
  await page.waitForLoadState("networkidle");

  // 看页面是否有 outline editor / "编辑课程目录草稿" 入口
  console.log("\n=== Looking for 编辑课程目录草稿 ===");
  const editDraftBtn = page.getByText(/编辑课程目录草稿|目录草稿|草稿/, { exact: false }).first();
  const exists = await editDraftBtn.count();
  console.log("found edit draft button:", exists);
  
  if (exists > 0) {
    await editDraftBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SS}/04-edit-draft-clicked.png`, fullPage: true });
    
    // 找章节名 input 
    const inputs = await page.locator('input[type="text"], input:not([type])').all();
    console.log(`found ${inputs.length} text inputs in draft editor`);
    
    if (inputs.length > 0) {
      // 测打字延迟 - 在第一个 input 里逐字打入
      const firstInput = inputs[0];
      await firstInput.focus();
      const startVal = await firstInput.inputValue();
      console.log("first input initial value:", startVal);
      
      // 分 10 次 keystroke 打入 "测试章节名" 5 个字
      const text = "测试章节名";
      const timings: number[] = [];
      for (let i = 0; i < text.length; i++) {
        const t0 = Date.now();
        await firstInput.type(text[i], { delay: 0 });
        const elapsed = Date.now() - t0;
        timings.push(elapsed);
      }
      console.log("per-keystroke timings (ms):", timings);
      console.log("avg keystroke ms:", timings.reduce((a, b) => a + b) / timings.length);
      
      await page.screenshot({ path: `${SS}/05-after-typing.png`, fullPage: true });
    }
  }
});
