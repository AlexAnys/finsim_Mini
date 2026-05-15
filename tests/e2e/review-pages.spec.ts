/**
 * Stream D — 页面端到端实测（read-only review）
 * 不修改业务代码，仅截图与时序记录。
 *
 * 运行：
 *   npx playwright test tests/e2e/review-pages.spec.ts --reporter=line
 */
import { test, expect, Page, Browser } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3000";
const OUT = path.resolve(
  process.cwd(),
  ".harness/screenshots/review-2026-05-13/pages",
);
const LOG = path.resolve(OUT, "trace.log");

function log(line: string) {
  const stamp = new Date().toISOString().slice(11, 23);
  const entry = `[${stamp}] ${line}\n`;
  fs.appendFileSync(LOG, entry);
  console.log(entry.trim());
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  const t0 = Date.now();
  await page.click('button[type="submit"]');
  // wait for redirect (auth.js sets cookie)
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
  log(`login ${email} → ${Date.now() - t0}ms → ${page.url()}`);
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
  fs.writeFileSync(LOG, `=== Pages e2e review ${new Date().toISOString()} ===\n`);
});

test("01 — 未登录访问受保护页 → 跳转 /login", async ({ page }) => {
  const targets = ["/dashboard", "/teacher/dashboard", "/grades"];
  for (const t of targets) {
    const t0 = Date.now();
    await page.goto(`${BASE}${t}`, { waitUntil: "networkidle" });
    log(`unauth ${t} → ${Date.now() - t0}ms → ${page.url()}`);
    expect(page.url()).toContain("/login");
  }
  await shot(page, "01-unauth-login");
});

test("02 — 学生 dashboard 加载", async ({ page }) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  const t0 = Date.now();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  log(`student-dash → ${Date.now() - t0}ms`);
  await shot(page, "02-student-dashboard");
  // check for 加载中
  const loadingNow = await page.locator("text=加载中").count();
  log(`student-dash still loading? ${loadingNow}`);
});

test("03 — 学生访问 /teacher/dashboard（应被 ForbiddenState 阻止）", async ({
  page,
}) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  const t0 = Date.now();
  await page.goto(`${BASE}/teacher/dashboard`, { waitUntil: "networkidle" });
  log(`student→teacher-dash → ${Date.now() - t0}ms → ${page.url()}`);
  await shot(page, "03-student-on-teacher");
  const forbidden = await page
    .locator("text=/还不能看|教师工作台|无权|forbidden/i")
    .count();
  log(`student-on-teacher forbidden marker found: ${forbidden}`);
});

test("04 — 不存在的 task id → 看 error/not-found UX", async ({ page }) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  const t0 = Date.now();
  await page.goto(
    `${BASE}/tasks/00000000-0000-0000-0000-000000000000`,
    { waitUntil: "networkidle" },
  );
  log(`bad-task-id → ${Date.now() - t0}ms`);
  await shot(page, "04-bad-task-id");
  const bodyText = await page.locator("body").innerText();
  log(`bad-task-id body snippet: ${bodyText.slice(0, 200).replace(/\n/g, " ")}`);
});

test("05 — 学生 /grades 列表加载", async ({ page }) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  const t0 = Date.now();
  await page.goto(`${BASE}/grades`, { waitUntil: "networkidle" });
  log(`student-grades → ${Date.now() - t0}ms`);
  await shot(page, "05-student-grades");
});

test("06 — 教师 dashboard / tasks / instances 三页耗时", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  for (const route of ["/teacher/dashboard", "/teacher/tasks", "/teacher/instances"]) {
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    const dt = Date.now() - t0;
    log(`teacher ${route} → ${dt}ms`);
    await shot(page, `06-teacher${route.replace(/\//g, "_")}`);
  }
});

test("07 — 跨账号 cookie 串号：老师 → 学生 → 看不到老师草稿", async ({
  browser,
}: {
  browser: Browser;
}) => {
  // 共享同一个 context 模拟同一浏览器
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/tasks`, { waitUntil: "networkidle" });
  await shot(page, "07a-teacher-tasks-before-switch");

  // 退出
  const t0 = Date.now();
  await page.goto(`${BASE}/api/auth/signout`).catch(() => {});
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  log(`signout → ${Date.now() - t0}ms → ${page.url()}`);

  await loginAs(page, "student1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "07b-student-after-switch");

  // 检查 localStorage 是否清理（PR 9a761d1 已修，验证）
  const lsKeys = await page.evaluate(() => Object.keys(localStorage));
  const ssKeys = await page.evaluate(() => Object.keys(sessionStorage));
  log(`student LS keys: ${JSON.stringify(lsKeys)}`);
  log(`student SS keys: ${JSON.stringify(ssKeys)}`);

  // 学生再访问 /teacher/tasks
  await page.goto(`${BASE}/teacher/tasks`, { waitUntil: "networkidle" });
  await shot(page, "07c-student-on-teacher-tasks");
  log(`student on teacher-tasks → ${page.url()}`);

  await ctx.close();
});

test("08 — sim/[id] 预览模式（preview=true 行为）", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  // 找一个 sim 任务实例 — 从 /teacher/instances 拿
  await page.goto(`${BASE}/teacher/instances`, { waitUntil: "networkidle" });
  await shot(page, "08a-teacher-instances");
  // 直接 visit 一个不存在的 sim id 看 sim layout 表现
  await page.goto(
    `${BASE}/sim/00000000-0000-0000-0000-000000000000?preview=true`,
    { waitUntil: "networkidle" },
  );
  await shot(page, "08b-sim-bad-id-preview");
  log(`sim/bad-id preview → ${page.url()}`);
});

test("09 — 学生 dashboard 控制台无致命报错（client error 检测）", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`PAGEERR: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text().slice(0, 200)}`);
  });
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  log(`student-dash errors=${errors.length}`);
  for (const e of errors.slice(0, 8)) log(`  ${e}`);
});
