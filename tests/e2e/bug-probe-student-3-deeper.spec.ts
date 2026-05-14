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

// adaptive quiz (10q): a7d9b380-49fd-4ce2-9d95-000935ac0c5a
// fixed quiz (8q): 449ae28c-8913-43f5-adda-dc296885071b (个人理财基础概念测验)
// subjective with attachments: a5d8f119-e3cd-426f-8ea9-e57f77608ffe
// subjective without attachments: 00000000-0000-4000-8000-00000000a603
// quiz with 0 questions but published: 7db59a62-e806-44c6-b102-e767f61ed8bb (PDF导入测验)

test("STU-QUIZ-2: adaptive 模式真实题目页 + 即时反馈/自适应行为", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks/a7d9b380-49fd-4ce2-9d95-000935ac0c5a`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${SS}/14-quiz-adaptive-entry.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("ADAPTIVE QUIZ ENTRY (1500):", body.slice(0, 1500));

  // 找开始按钮
  const startBtn = page.locator("button").filter({ hasText: /开始/ });
  if ((await startBtn.count()) > 0) {
    await startBtn.first().click();
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: `${SS}/15-quiz-adaptive-q1.png`, fullPage: true });
    const q1Body = await page.locator("body").innerText();
    console.log("ADAPTIVE Q1 PAGE (1800):", q1Body.slice(0, 1800));

    // 看是否有难度标记 / 自适应描述
    const difficultyHints = await page
      .locator("text=/难度|自适应|adaptive|实时|即时|当前题|进度/i")
      .count();
    console.log("ADAPTIVE 难度/自适应文案数:", difficultyHints);

    // 看选项渲染 — 必须有正常 ABCD
    const options = page.locator('label, button').filter({ hasText: /^[A-D]/ });
    console.log("选项渲染数（A-D 开头 label/button）:", await options.count());

    // 不点提交，只点第一个选项看 UI 反应
    const firstOption = page.getByRole("radio").first();
    if ((await firstOption.count()) > 0) {
      await firstOption.click().catch(() => {});
      await page.waitForTimeout(1_000);
      await page.screenshot({ path: `${SS}/16-quiz-adaptive-q1-selected.png`, fullPage: true });
    }
  }
  console.log("STU-QUIZ-2 CONSOLE ERRORS:", consoleErrors.slice(0, 6));
});

test("STU-QUIZ-3: 0 题目已发布测验（PDF导入测验 / a601）", async ({ page }) => {
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks/7db59a62-e806-44c6-b102-e767f61ed8bb`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/17-quiz-empty-published.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("0 题目测验页:", body.slice(0, 1000));
});

test("STU-SUBJ-2: 有附件配置的主观题（pdf/docx/xlsx）", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");
  await page.goto(`${BASE}/tasks/a5d8f119-e3cd-426f-8ea9-e57f77608ffe`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: `${SS}/18-subj-with-attachment.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  console.log("SUBJ 带附件 (1800):", body.slice(0, 1800));

  // 附件 input 详细
  const inputs = page.locator('input[type="file"]');
  const cnt = await inputs.count();
  console.log("SUBJ file input 数量:", cnt);
  for (let i = 0; i < cnt; i++) {
    const el = inputs.nth(i);
    const accept = await el.getAttribute("accept");
    const capture = await el.getAttribute("capture");
    const multiple = await el.getAttribute("multiple");
    const name = await el.getAttribute("name");
    console.log(`  input[${i}] accept="${accept}" capture="${capture}" multiple="${multiple}" name="${name}"`);
  }

  // 拍照 / 相机入口
  const camera = await page.locator("text=/拍照|相机|camera/i").count();
  console.log("SUBJ 拍照入口:", camera);

  // 量规
  const rubricCnt = await page.locator("text=/评分标准|量规|得分点|评分项/").count();
  console.log("SUBJ 量规相关:", rubricCnt);

  console.log("STU-SUBJ-2 CONSOLE ERRORS:", consoleErrors.slice(0, 6));
});

test("STU-AUTH-1: 权限边界 — 跨班 instance + admin/teacher 路由 + API", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
  });
  await login(page, "alex@qq.com", "11");

  // 1. teacher 路由（应被 redirect 或 403）
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1_500);
  console.log("teacher/dashboard final URL:", page.url());
  await page.screenshot({ path: `${SS}/19-teacher-route-as-student.png`, fullPage: true });
  const tBody = await page.locator("body").innerText();
  console.log("teacher/dashboard body 头部 (400):", tBody.slice(0, 400));

  // 2. admin 路由
  await page.goto(`${BASE}/admin`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1_500);
  console.log("admin final URL:", page.url());
  const aBody = await page.locator("body").innerText();
  console.log("admin body 头部 (400):", aBody.slice(0, 400));

  // 3. teacher API endpoints
  const apiResp = await page.evaluate(async () => {
    const probes: Record<string, { status: number; sample: string }> = {};
    const endpoints = [
      "/api/teacher/courses",
      "/api/lms/courses",
      "/api/admin/audit-logs",
      "/api/teacher/dashboard/summary",
      "/api/teacher/analytics-v2/scope",
    ];
    for (const url of endpoints) {
      try {
        const r = await fetch(url);
        const text = await r.text();
        probes[url] = { status: r.status, sample: text.slice(0, 120) };
      } catch (e) {
        probes[url] = { status: -1, sample: String(e).slice(0, 120) };
      }
    }
    return probes;
  });
  console.log("API 权限探测:", JSON.stringify(apiResp, null, 2));

  // 4. 跨班学生 task instance — molly 老师另开的实例，alex 不在 deedd844 之外的班
  // 找一个不属于 alex 班的 TaskInstance
  const otherInstanceProbe = await page.evaluate(async () => {
    const r = await fetch("/api/lms/task-instances/9201ff97-d2fb-43e7-a5b0-23d763d55477");
    return { status: r.status, text: (await r.text()).slice(0, 300) };
  });
  console.log("B4 独立测验（无 courseTitle 的）API 反应:", JSON.stringify(otherInstanceProbe));

  console.log("STU-AUTH-1 CONSOLE ERRORS:", consoleErrors.slice(0, 8));
});
