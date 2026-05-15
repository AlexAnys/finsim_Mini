/**
 * Probe M2 — 课程与材料工作台
 * Read-only, no edits to source. Screenshots only.
 */
import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3000";
const OUT = path.resolve(process.cwd(), ".harness/screenshots/probe-m2");

function log(line: string) {
  const stamp = new Date().toISOString().slice(11, 23);
  console.log(`[${stamp}] ${line}`);
  fs.appendFileSync(path.join(OUT, "trace.log"), `[${stamp}] ${line}\n`);
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
  log(`logged in ${email} → ${page.url()}`);
}

async function shot(page: Page, name: string) {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await page
    .screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
    .catch((e) => log(`shot fail ${name}: ${e.message}`));
}

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(() => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "trace.log"),
    `=== Probe M2 ${new Date().toISOString()} ===\n`,
  );
});

test("01 — 教师课程列表页（新建课程对话框）", async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => log(`pageerror: ${err.message}`));
  page.on("response", (resp) => {
    if (resp.status() >= 400)
      log(`http ${resp.status()} ${resp.url()}`);
  });

  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const t0 = Date.now();
  await page.goto(`${BASE}/teacher/courses`, { waitUntil: "networkidle" });
  log(`/teacher/courses → ${Date.now() - t0}ms`);
  await shot(page, "01-courses-list");

  // 新建课程对话框
  await page.getByRole("button", { name: /新建课程/ }).click();
  await page.waitForTimeout(500);
  await shot(page, "02-create-course-dialog");

  // 检查必填项与字段
  const titleInput = page.locator('input#courseTitle');
  const codeInput = page.locator('input#courseCode');
  const descInput = page.locator('textarea#description');
  const selectTrigger = page
    .getByRole("combobox")
    .or(page.locator('[role="combobox"]'));

  log(`title:${await titleInput.count()} code:${await codeInput.count()} desc:${await descInput.count()} select:${await selectTrigger.count()}`);

  // 测试空提交
  const confirmBtn = page.getByRole("button", { name: /确认创建/ });
  await confirmBtn.click();
  await page.waitForTimeout(300);
  await shot(page, "03-create-empty-validation");

  // 关闭对话框
  await page.getByRole("button", { name: /^取消$/ }).click();
});

test("02 — 课程详情页结构（章节 / 三阶段目录）", async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => log(`pageerror: ${err.message}`));
  page.on("response", (resp) => {
    if (resp.status() >= 400) log(`http ${resp.status()} ${resp.url()}`);
  });

  await loginAs(page, "teacher1@finsim.edu.cn", "password123");

  // 取第一门课
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const json = await res.json();
  log(`courses count: ${(json.data || []).length}`);
  const firstId = json.data?.[0]?.id;
  if (!firstId) {
    log("NO COURSE — skipping");
    test.skip();
    return;
  }

  const t0 = Date.now();
  await page.goto(`${BASE}/teacher/courses/${firstId}`, {
    waitUntil: "networkidle",
  });
  log(`detail page → ${Date.now() - t0}ms`);
  await shot(page, "04-detail-main");

  // 查找"课前/课中/课后"slot 字样
  const pre = await page.getByText("课前").count();
  const mid = await page.getByText("课中").count();
  const post = await page.getByText("课后").count();
  log(`slot labels: 课前=${pre} 课中=${mid} 课后=${post}`);

  // 查找 tabs（教学结构 / 任务 / 数据洞察 / 教学上下文 / Study Buddy）
  const tabs = await page.locator('[role="tab"]').allTextContents();
  log(`tabs: ${tabs.join(" | ")}`);
  await shot(page, "05-tabs");
});

test("03 — 教学上下文（课程素材）tab", async ({ page }) => {
  page.on("response", (resp) => {
    if (resp.status() >= 400) log(`http ${resp.status()} ${resp.url()}`);
  });
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const json = await res.json();
  const firstId = json.data?.[0]?.id;
  if (!firstId) {
    test.skip();
    return;
  }
  await page.goto(`${BASE}/teacher/courses/${firstId}`, {
    waitUntil: "networkidle",
  });

  // 点击 "教学上下文" tab（如果存在）
  const contextTab = page.getByRole("tab", { name: /教学上下文|课程素材|素材/ });
  const has = await contextTab.count();
  log(`context-tab found: ${has}`);
  if (has) {
    await contextTab.first().click();
    await page.waitForTimeout(800);
    await shot(page, "06-context-tab");

    // 列出素材
    const sourceRows = await page
      .locator('[data-source-id], [data-knowledge-source-id], .knowledge-source')
      .count();
    log(`source rows (by data attr): ${sourceRows}`);
  }
});

test("04 — 协作教师 + 多班级", async ({ page }) => {
  page.on("response", (resp) => {
    if (resp.status() >= 400) log(`http ${resp.status()} ${resp.url()}`);
  });
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const json = await res.json();
  const firstId = json.data?.[0]?.id;
  if (!firstId) {
    test.skip();
    return;
  }

  // 通过 API 查协作教师 & 班级
  const tRes = await page.request.get(
    `${BASE}/api/lms/courses/${firstId}/teachers`,
  );
  const cRes = await page.request.get(
    `${BASE}/api/lms/courses/${firstId}/classes`,
  );
  const tJson = await tRes.json();
  const cJson = await cRes.json();
  log(
    `teachers payload: ${JSON.stringify(tJson).slice(0, 250)}`,
  );
  log(
    `classes payload: ${JSON.stringify(cJson).slice(0, 250)}`,
  );

  // 打开"编辑课程信息"对话框（可能在 hero 上有 edit 按钮）
  await page.goto(`${BASE}/teacher/courses/${firstId}`, {
    waitUntil: "networkidle",
  });

  // 找编辑按钮
  const editBtns = await page.locator("button").allTextContents();
  log(`buttons: ${editBtns.slice(0, 40).join(" | ")}`);
  await shot(page, "07-detail-buttons");
});

test("05 — 学生 Study Buddy 引用课程素材", async ({ page }) => {
  page.on("response", (resp) => {
    if (resp.status() >= 400) log(`http ${resp.status()} ${resp.url()}`);
  });
  await loginAs(page, "student1@finsim.edu.cn", "password123");

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "08-student-dash");

  // Study Buddy 路由
  const tryPaths = ["/study-buddy", "/student/study-buddy", "/learn"];
  for (const p of tryPaths) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    log(`tried ${p} → ${page.url()}`);
  }

  // 找一门学生课程
  const courseRes = await page.request.get(`${BASE}/api/lms/courses`);
  const cJson = await courseRes.json();
  log(`student courses: ${JSON.stringify(cJson).slice(0, 200)}`);
});

test("06 — 删除带任务的章节 — 行为", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const json = await res.json();
  const firstId = json.data?.[0]?.id;
  if (!firstId) {
    test.skip();
    return;
  }
  // 拉课程详情查 chapters
  const detailRes = await page.request.get(
    `${BASE}/api/lms/courses/${firstId}`,
  );
  const detail = await detailRes.json();
  const chapters = detail.data?.chapters || [];
  log(`chapter count: ${chapters.length}`);
  // 找一个含 taskInstances 的章节
  for (const ch of chapters) {
    let totalTasks = 0;
    for (const sec of ch.sections || []) {
      totalTasks += (sec.taskInstances || []).length;
    }
    log(`chapter ${ch.id} title="${ch.title}" sections=${ch.sections?.length || 0} tasks=${totalTasks}`);
  }
});
