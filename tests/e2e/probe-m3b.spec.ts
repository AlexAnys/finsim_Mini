import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/probe-m3b";

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(300_000);

test("M3b-1: 教师 — 题库上传/AI 出题入口 + adaptive 模式选项", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "teacher1@finsim.edu.cn", "password123");

  // 1. /teacher/courses → 第一门课程详情页
  await page.goto(`${BASE}/teacher/courses`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/01-teacher-courses.png`, fullPage: true });

  // 第一门课 link
  const courseLink = page.locator('a[href*="/teacher/courses/"]').first();
  if (await courseLink.count() > 0) {
    await courseLink.click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SS}/02-course-detail.png`, fullPage: true });

    // 找 "上传题库" 入口
    const uploadBtn = page.getByRole("button", { name: /上传题库/ });
    console.log("M3b 上传题库 按钮可见性:", await uploadBtn.count());
    if (await uploadBtn.count() > 0) {
      await uploadBtn.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SS}/03-upload-question-bank-btn.png` });
    }
  }

  // 2. 新建测验任务页 — 看 adaptive 选项是否真正起作用
  await page.goto(`${BASE}/teacher/tasks/new`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/04-task-wizard-entry.png`, fullPage: true });
  const wizardText = await page.locator("body").innerText();
  console.log("WIZARD TEXT SAMPLE:", wizardText.slice(0, 800));

  if (consoleErrors.length > 0) console.log("M3b-1 CONSOLE ERRORS:", consoleErrors.slice(0, 5));
});

test("M3b-2: 学生 — 测验作答 + 选项展示 + 提交后批改", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "student1@finsim.edu.cn", "password123");

  // 学生 dashboard 找 quiz 任务
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/10-student-dashboard.png`, fullPage: true });

  // 找 "测验" / "理财基础" 任务
  const quizCard = page.locator("a").filter({ hasText: /测验|理财基础/i }).first();
  if (await quizCard.count() > 0) {
    await quizCard.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/11-quiz-task-detail.png`, fullPage: true });

    const bodyText = await page.locator("body").innerText();
    console.log("QUIZ DETAIL TEXT SAMPLE:", bodyText.slice(0, 1200));

    // 开始答题 / 进入测验
    const startBtn = page.getByRole("button", { name: /开始|进入|继续/ });
    if (await startBtn.count() > 0) {
      await startBtn.first().click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/12-quiz-runner.png`, fullPage: true });

      const runnerText = await page.locator("body").innerText();
      console.log("QUIZ RUNNER TEXT SAMPLE:", runnerText.slice(0, 1500));
    }
  }
  if (consoleErrors.length > 0) console.log("M3b-2 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("M3b-3: 学生 — 主观题 + 附件上传 (检查 capture/拍照支持)", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "student1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");

  // 找 "主观题" / "投资组合" 任务
  const subjCard = page.locator("a").filter({ hasText: /主观|投资组合分析报告/i }).first();
  if (await subjCard.count() > 0) {
    await subjCard.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/20-subjective-task-detail.png`, fullPage: true });

    const startBtn = page.getByRole("button", { name: /开始|进入|继续/ });
    if (await startBtn.count() > 0) {
      await startBtn.first().click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/21-subjective-runner.png`, fullPage: true });

      // 直接看 DOM — 检查 input[type=file] 是否有 capture 属性
      const fileInputs = page.locator('input[type="file"]');
      const inputCount = await fileInputs.count();
      console.log("Subjective file inputs:", inputCount);
      for (let i = 0; i < inputCount; i++) {
        const accept = await fileInputs.nth(i).getAttribute("accept");
        const capture = await fileInputs.nth(i).getAttribute("capture");
        console.log(`  input[${i}]: accept=${accept} capture=${capture}`);
      }
    }
  }
  if (consoleErrors.length > 0) console.log("M3b-3 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("M3b-4: 学生 — Study Buddy 入口 + 章节关联 + 引用", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await login(page, "student1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/study-buddy`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/30-study-buddy-page.png`, fullPage: true });

  const sbText = await page.locator("body").innerText();
  console.log("STUDY BUDDY TEXT SAMPLE:", sbText.slice(0, 1500));

  // 提问对话框 — 看任务选择
  const newBtn = page.getByRole("button", { name: /提问|新建|新提问|发起对话/ });
  console.log("Study Buddy 新提问 按钮数:", await newBtn.count());
  if (await newBtn.count() > 0) {
    await newBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SS}/31-study-buddy-dialog.png`, fullPage: true });
  }
  if (consoleErrors.length > 0) console.log("M3b-4 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});

test("M3b-5: 教师 — Study Buddy 共性提问汇总入口", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle");

  // 找 "学情分析"、"数据洞察"、"Study Buddy 汇总"
  await page.screenshot({ path: `${SS}/40-teacher-dashboard.png`, fullPage: true });
  const dashText = await page.locator("body").innerText();
  console.log("TEACHER DASH TEXT:", dashText.slice(0, 1000));

  // 试 instances 页或 insights
  const instanceLink = page.locator("a").filter({ hasText: /任务实例|工作台|学情/i }).first();
  if (await instanceLink.count() > 0) {
    await instanceLink.click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SS}/41-teacher-instances.png`, fullPage: true });
  }
});

test("M3b-6: API 直调 — adaptive 模式 + Study Buddy posts + 题库 import-job", async ({ page, request }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");

  // 1) 拿教师的 cookie 再用 request 调 API
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // 测验任务 — 看 quizConfig.mode 是 fixed 还是 adaptive
  const tasks = await page.request.get(`${BASE}/api/lms/tasks?type=quiz`, { headers: { Cookie: cookieHeader } });
  const tj = await tasks.json().catch(() => ({}));
  console.log("Quiz tasks API status:", tasks.status());
  console.log("Quiz tasks payload:", JSON.stringify(tj).slice(0, 1500));

  // import-jobs
  const ij = await page.request.get(`${BASE}/api/import-jobs`, { headers: { Cookie: cookieHeader } });
  console.log("Import jobs API status:", ij.status());
  const ijb = await ij.text();
  console.log("Import jobs body:", ijb.slice(0, 600));

  // Study Buddy summary endpoint 是否存在
  // 用 student1 的视角拉自己的 posts
  await page.context().clearCookies();
  await login(page, "student1@finsim.edu.cn", "password123");
  const stuCookies = await page.context().cookies();
  const stuHeader = stuCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const sb = await page.request.get(`${BASE}/api/study-buddy/posts`, { headers: { Cookie: stuHeader } });
  console.log("Student study-buddy/posts status:", sb.status());
  const sbb = await sb.json().catch(() => ({}));
  console.log("Student study-buddy posts count:", Array.isArray(sbb?.data) ? sbb.data.length : "(not array)");
});
