/**
 * Probe M2 part 2 — 找到含 section 的课程，截图详细 slot 网格 + Study Buddy
 */
import { test, Page } from "@playwright/test";
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
}

async function shot(page: Page, name: string) {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await page
    .screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
    .catch((e) => log(`shot fail ${name}: ${e.message}`));
}

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

test("07 — 找到含 section 的课程并截 slot 网格", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const list = (await res.json()).data || [];
  let chosen: { id: string; sections: number } | null = null;
  for (const c of list) {
    const dRes = await page.request.get(`${BASE}/api/lms/courses/${c.id}`);
    const d = (await dRes.json()).data;
    if (!d) continue;
    let sec = 0;
    for (const ch of d.chapters || []) sec += ch.sections?.length || 0;
    log(`course "${d.courseTitle}" id=${d.id} chapters=${d.chapters?.length || 0} sections=${sec}`);
    if (sec > 0 && !chosen) chosen = { id: d.id, sections: sec };
  }
  if (!chosen) {
    log("NO COURSE WITH SECTIONS — using first to screenshot anyway");
    chosen = { id: list[0].id, sections: 0 };
  }
  await page.goto(`${BASE}/teacher/courses/${chosen.id}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(700);
  await shot(page, "10-course-with-sections");

  // 检查 slot 网格
  const pre = await page.getByText("课前", { exact: true }).count();
  const mid = await page.getByText("课中", { exact: true }).count();
  const post = await page.getByText("课后", { exact: true }).count();
  log(`(detail) 课前=${pre} 课中=${mid} 课后=${post}`);

  // 看是否有 "+ 任务" / 添加内容按钮
  const addTask = await page.getByText(/\+ ?任务/).count();
  const addBlock = await page.getByText(/添加内容|添加块|添加 block/).count();
  log(`addTaskBtn=${addTask} addBlockBtn=${addBlock}`);

  // 查找 知识源 / 教学上下文 入口
  const ctxTab = page.getByRole("tab", { name: /教学上下文/ });
  if ((await ctxTab.count()) > 0) {
    await ctxTab.first().click();
    await page.waitForTimeout(800);
    await shot(page, "11-context-tab-expanded");

    // 截图上传按钮 / 列表
    const upBtn = page.getByRole("button", { name: /上传|添加.*素材|添加.*资料/ });
    log(`upload buttons: ${await upBtn.count()}`);
  }
});

test("08 — 协作教师 dialog", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const firstId = (await res.json()).data?.[0]?.id;
  if (!firstId) {
    test.skip();
    return;
  }
  await page.goto(`${BASE}/teacher/courses/${firstId}`, {
    waitUntil: "networkidle",
  });
  const teacherBtn = page.getByRole("button", { name: /协作教师/ });
  if ((await teacherBtn.count()) > 0) {
    await teacherBtn.first().click();
    await page.waitForTimeout(500);
    await shot(page, "12-teacher-collab-dialog");
  }
});

test("09 — 添加班级 dialog", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const firstId = (await res.json()).data?.[0]?.id;
  if (!firstId) {
    test.skip();
    return;
  }
  await page.goto(`${BASE}/teacher/courses/${firstId}`, {
    waitUntil: "networkidle",
  });
  const btn = page.getByRole("button", { name: /添加班级/ });
  if ((await btn.count()) > 0) {
    await btn.first().click();
    await page.waitForTimeout(500);
    await shot(page, "13-add-class-dialog");
  }
});

test("10 — 上传大纲 dialog", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const firstId = (await res.json()).data?.[0]?.id;
  if (!firstId) {
    test.skip();
    return;
  }
  await page.goto(`${BASE}/teacher/courses/${firstId}`, {
    waitUntil: "networkidle",
  });
  const upload = page.getByRole("button", { name: /上传大纲/ });
  if ((await upload.count()) > 0) {
    await upload.first().click();
    await page.waitForTimeout(700);
    await shot(page, "14-upload-outline-dialog");
  }
});

test("11 — 学生 Study Buddy 页面", async ({ page }) => {
  page.on("response", (r) => {
    if (r.status() >= 400) log(`sb http ${r.status()} ${r.url()}`);
  });
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/study-buddy`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, "15-study-buddy");

  // 列表中已有 post 数
  const postRows = await page
    .locator('[data-post-id], .study-buddy-post-row, button')
    .count();
  log(`possible post rows: ${postRows}`);

  // 新建 post 按钮
  const newBtn = page.getByRole("button", { name: /新建|提问|发起|新.*问题/ });
  log(`new-post buttons: ${await newBtn.count()}`);
  if ((await newBtn.count()) > 0) {
    await newBtn.first().click();
    await page.waitForTimeout(700);
    await shot(page, "16-new-post-dialog");

    // 看是否需选 task
    const taskSelector = page.locator('[role="combobox"]');
    log(`task selectors in dialog: ${await taskSelector.count()}`);
  }
});

test("12 — 检查所有课程的 knowledge sources（API）", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const courseRes = await page.request.get(`${BASE}/api/lms/courses`);
  const courses = (await courseRes.json()).data || [];
  for (const c of courses) {
    const r = await page.request.get(
      `${BASE}/api/lms/course-knowledge-sources?courseId=${c.id}`,
    );
    const j = await r.json();
    log(
      `course "${c.courseTitle}" sources: ${(j.data || []).length} ${JSON.stringify((j.data || []).slice(0, 2).map((s: { fileName: string; status: string; sourceType: string }) => ({ fn: s.fileName, st: s.status, ty: s.sourceType })))}`,
    );
  }
});
