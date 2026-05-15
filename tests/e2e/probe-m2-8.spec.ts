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
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"));
}

test.use({ viewport: { width: 1440, height: 900 } });

test("20 — click '+ 任务' wizard opens", async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`console.error: ${msg.text()}`);
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) log(`http ${resp.status()} ${resp.url()}`);
  });
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  // Course with sections
  await page.goto(
    `${BASE}/teacher/courses/ec619c34-99ed-4e45-9f97-2bcd43c1bcb1`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(800);

  const taskBtns = await page.locator('button[aria-label*="添加任务"]').all();
  log(`+任务 buttons: ${taskBtns.length}`);
  if (taskBtns.length > 0) {
    await taskBtns[0].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, "17-wizard-opened.png"), fullPage: true });
    log(`screenshot saved`);
    // 看 wizard 是否打开
    const wizardTitle = await page.getByText(/新建任务|任务向导|创建任务/).count();
    log(`wizard title count: ${wizardTitle}`);
  }

  const blockBtns = await page.locator('button[aria-label*="添加内容块"]').all();
  log(`+块 buttons: ${blockBtns.length}`);
});

test("21 — 测试上传非允许类型 + 大文件", async ({ page }) => {
  page.on("response", (resp) => {
    if (resp.status() >= 400) log(`http ${resp.status()} ${resp.url()}`);
  });
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");

  // 直接 POST 一个 disallowed file 看回退
  const form = new FormData();
  // Build a small fake jpg buffer
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" });
  form.append("file", blob, "x.jpg");
  form.append("courseId", "ec619c34-99ed-4e45-9f97-2bcd43c1bcb1");
  form.append("sourceType", "syllabus");

  const r = await page.request.post(
    `${BASE}/api/lms/course-knowledge-sources`,
    { multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from([1,2,3,4]) }, courseId: "ec619c34-99ed-4e45-9f97-2bcd43c1bcb1", sourceType: "syllabus" } },
  );
  log(`upload jpg status: ${r.status()} body: ${(await r.text()).slice(0,300)}`);
});
