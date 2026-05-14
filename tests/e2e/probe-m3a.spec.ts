/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/probe-m3a";

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

async function loginStudent(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "student1@finsim.edu.cn");
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(300_000);

test("M3a-1: 教师 — 模拟任务建设入口 + 必填项 + AI 客户配置 + 评分量规", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/tasks`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/01-teacher-tasks-list.png`, fullPage: true });

  // 进入创建向导
  await page.goto(`${BASE}/teacher/tasks/new`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/02-task-wizard-entry.png`, fullPage: true });

  // 探查类型卡：找到「模拟」类型
  const labels = await page.locator("body").innerText();
  console.log("WIZARD PAGE TEXT SAMPLE:", labels.slice(0, 1200));
  await page.screenshot({ path: `${SS}/03-wizard-type.png`, fullPage: true });

  if (consoleErrors.length > 0) console.log("CONSOLE ERRORS:", consoleErrors.slice(0, 5));
});

test("M3a-2: 学生 — 找到模拟任务并打开 sim 全屏 runner", async ({ page }) => {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));
  page.on("response", async (r) => {
    if (r.status() >= 400) {
      networkErrors.push(`${r.status()} ${r.url().slice(0, 150)}`);
    }
  });

  await loginStudent(page);
  await page.screenshot({ path: `${SS}/10-student-dashboard.png`, fullPage: true });
  console.log("after login url:", page.url());

  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/11-student-dash.png`, fullPage: true });

  // 探查学生 tasks 列表
  await page.goto(`${BASE}/tasks`).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/12-student-tasks.png`, fullPage: true });

  const pageText = await page.locator("body").innerText();
  console.log("STUDENT TASKS PAGE TEXT:", pageText.slice(0, 2000));

  if (consoleErrors.length > 0) console.log("CONSOLE ERRORS:", consoleErrors.slice(0, 5));
  if (networkErrors.length > 0) console.log("NETWORK ERRORS:", networkErrors.slice(0, 10));
});

test("M3a-3: 学生进入 simulation runner + 多轮对话 + 结束流程", async ({ page }) => {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));
  page.on("response", async (r) => {
    if (r.status() >= 400) {
      networkErrors.push(`${r.status()} ${r.url().slice(0, 150)}`);
    }
  });

  await loginStudent(page);

  // Use API to find a sim task instance assignable to student1
  const meRes = await page.request.get(`${BASE}/api/auth/session`);
  const me = await meRes.json().catch(() => null);
  console.log("ME:", JSON.stringify(me).slice(0, 200));

  // Query student dashboard tasks
  const tasksRes = await page.request.get(`${BASE}/api/lms/task-instances?role=student`);
  const tasksJson = await tasksRes.json().catch(() => null);
  console.log("TASK_INSTANCES STATUS:", tasksRes.status());
  const instances = tasksJson?.data?.instances || tasksJson?.data || [];
  console.log("TASK_INSTANCES COUNT:", Array.isArray(instances) ? instances.length : "non-array");
  const simInstance = (Array.isArray(instances) ? instances : []).find((i: any) => 
    i.taskType === "simulation" || i.task?.taskType === "simulation"
  );
  console.log("FOUND SIM INSTANCE:", simInstance ? JSON.stringify({
    id: simInstance.id, title: simInstance.title || simInstance.task?.taskName, taskType: simInstance.taskType
  }) : "NONE");

  if (!simInstance) {
    await page.screenshot({ path: `${SS}/20-no-sim-task.png`, fullPage: true });
    console.log("NO SIM TASK — skip rest");
    return;
  }

  await page.goto(`${BASE}/sim/${simInstance.id}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/21-sim-runner-load.png`, fullPage: true });

  // 检查关键元素
  const bodyText = await page.locator("body").innerText();
  const has场景 = bodyText.includes("背景情景") || bodyText.includes("场景");
  const has对话 = bodyText.includes("对话");
  const has结束 = bodyText.includes("结束对话");
  const has重来 = bodyText.includes("重来");
  console.log("HAS 场景:", has场景, "HAS 对话:", has对话, "HAS 结束:", has结束, "HAS 重来:", has重来);

  // 发送 3 轮对话
  for (let turn = 1; turn <= 3; turn++) {
    const textarea = page.locator('textarea').first();
    const exists = await textarea.count();
    if (!exists) {
      console.log(`Turn ${turn}: textarea NOT FOUND`);
      break;
    }
    await textarea.fill(`我想问问您对当前市场的看法，您比较担心哪类风险？(turn ${turn})`);
    await page.screenshot({ path: `${SS}/22-turn${turn}-typed.png`, fullPage: true });
    // 触发发送：找 send 按钮 或 cmd+enter
    const sendBtn = page.getByRole('button', { name: /发送|Send/i }).first();
    const sendVisible = await sendBtn.count() > 0 && await sendBtn.isVisible().catch(() => false);
    if (sendVisible) {
      await sendBtn.click().catch(() => {});
    } else {
      await textarea.press('Enter');
    }
    await page.waitForTimeout(5500); // wait for SSE stream
    await page.screenshot({ path: `${SS}/23-turn${turn}-aireply.png`, fullPage: true });
  }

  // 尝试结束对话
  const finishBtn = page.getByRole('button', { name: /结束对话/i }).first();
  const finishVisible = await finishBtn.count() > 0;
  console.log("FINISH BTN VISIBLE:", finishVisible);
  if (finishVisible) {
    await finishBtn.click().catch(() => {});
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${SS}/24-after-finish.png`, fullPage: true });
  }

  console.log("CONSOLE ERRORS:", consoleErrors.slice(0, 10));
  console.log("NETWORK ERRORS:", networkErrors.slice(0, 15));
});

test("M3a-4: 教师 preview — /sim/[id]?preview=true 工作流", async ({ page }) => {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));
  page.on("response", async (r) => {
    if (r.status() >= 400) {
      networkErrors.push(`${r.status()} ${r.url().slice(0, 150)}`);
    }
  });

  await loginTeacher(page);
  // 找一个 sim task instance
  const tasksRes = await page.request.get(`${BASE}/api/lms/task-instances?role=teacher`);
  const tasksJson = await tasksRes.json().catch(() => null);
  console.log("TEACHER TASK_INSTANCES STATUS:", tasksRes.status());
  console.log("TEACHER TASK SAMPLE:", JSON.stringify(tasksJson).slice(0, 600));
  const all = tasksJson?.data?.instances || tasksJson?.data || [];
  const simInst = (Array.isArray(all) ? all : []).find((i: any) =>
    i.taskType === "simulation" || i.task?.taskType === "simulation"
  );
  if (!simInst) {
    console.log("NO SIM INSTANCE FOR TEACHER — skip");
    return;
  }
  console.log("FOUND SIM INSTANCE FOR PREVIEW:", simInst.id);
  await page.goto(`${BASE}/sim/${simInst.id}?preview=true`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/30-preview.png`, fullPage: true });
  const text = await page.locator("body").innerText();
  console.log("PREVIEW HAS 模拟对话:", text.includes("模拟对话"));
  console.log("PREVIEW HAS 预览模式:", text.includes("预览模式"));
  console.log("CONSOLE ERRORS:", consoleErrors.slice(0, 5));
  console.log("NETWORK ERRORS:", networkErrors.slice(0, 8));
});
