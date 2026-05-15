/**
 * Bug-probe teacher — focused deep dives.
 * READ-ONLY.
 */
import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3000";
const SS = path.resolve(process.cwd(), ".harness/screenshots/bug-probe-teacher");
const MOLLY_OWN_COURSE = "8f7f653c-9177-44f6-b764-80f7f779b2ef"; // 个人规划
const COLLAB_COURSE_A = "e6fc049c-756f-4442-86da-35a6cdbadd6e"; // teacher1 个人理财规划
const COLLAB_COURSE_B = "940bbe23-6172-40bf-bc7f-b22a1840a1de";
const INSTANCE_GRADED = "449ae28c-8913-43f5-adda-dc296885071b"; // 个人理财基础概念测验 - has 1 graded submission

function ensure() {
  if (!fs.existsSync(SS)) fs.mkdirSync(SS, { recursive: true });
}

async function login(page: Page, email: string, pwd: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', pwd);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function shot(page: Page, name: string) {
  ensure();
  await page.screenshot({ path: path.join(SS, `${name}.png`), fullPage: true }).catch(() => {});
}

function attachConsole(page: Page, label: string) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(`[${label} ${m.type()}]`, m.text().slice(0, 280));
  });
  page.on("pageerror", (e) => console.log(`[${label} pageerror]`, e.message.slice(0, 280)));
  page.on("response", (r) => {
    if (r.status() >= 400) console.log(`[${label} http ${r.status()}]`, r.url().slice(0, 220));
  });
}

test.setTimeout(180_000);

test("D1 /teacher/tasks check (200 or 404)", async ({ page }) => {
  attachConsole(page, "tasks");
  await login(page, "molly@qq.com", "123456");

  const resp = await page.goto(`${BASE}/teacher/tasks`).catch(() => null);
  console.log("/teacher/tasks final:", page.url(), "status:", resp?.status());
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D1-tasks-index");
  const body = (await page.locator("body").textContent()) ?? "";
  console.log("tasks body 800:", body.slice(0, 800).replace(/\s+/g, " "));
});

test("D2 close instance dialog probe (cancel out)", async ({ page }) => {
  attachConsole(page, "close");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/instances/${INSTANCE_GRADED}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D2-inst-before");

  // Find "关闭实例" button
  const close = page.getByRole("button", { name: /关闭实例|关闭$/ }).first();
  console.log("close btn count:", await close.count());

  if (await close.count()) {
    await close.click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "D2-inst-close-dialog");

    // Look for confirm dialog / cancel button
    const body = (await page.locator("body").textContent()) ?? "";
    const dialogIdx = Math.max(body.indexOf("确认"), body.indexOf("将关闭"), body.indexOf("关闭后"));
    console.log("dialog excerpt:", body.slice(Math.max(0, dialogIdx - 50), dialogIdx + 600).replace(/\s+/g, " "));

    // Press Esc to cancel — DO NOT confirm
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await shot(page, "D2-inst-after-cancel");
  }
});

test("D3 closed instances filter — see reopen?", async ({ page }) => {
  attachConsole(page, "closed");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/instances`);
  await page.waitForLoadState("networkidle").catch(() => {});

  const closedTab = page.locator('button:has-text("已关闭"), [role="tab"]:has-text("已关闭")').first();
  console.log("closed tab count:", await closedTab.count());

  if (await closedTab.count()) {
    await closedTab.click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "D3-instances-closed-tab");

    const body = (await page.locator("body").textContent()) ?? "";
    console.log("closed tab excerpt:", body.slice(0, 1200).replace(/\s+/g, " "));

    // Buttons in closed tab
    const btns = await page.locator("button, [role='button']").allTextContents();
    const reopen = btns.filter((b) => /开放|重启|重开|重新|reopen/i.test(b));
    console.log("reopen-like buttons:", reopen);
  }
});

test("D4 task edit click — what's editable?", async ({ page }) => {
  attachConsole(page, "edit");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/tasks/3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9`); // 个人理财基础概念测验
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D4-task-overview");

  const edit = page.getByRole("button", { name: /编辑$/ }).first();
  console.log("edit btn:", await edit.count());
  if (await edit.count()) {
    await edit.click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "D4-task-edit-mode");

    const url = page.url();
    console.log("after edit click url:", url);
    const body = (await page.locator("body").textContent()) ?? "";
    console.log("edit page excerpt:", body.slice(0, 1200).replace(/\s+/g, " "));

    // Find inputs / textareas
    const inputs = await page.locator("input, textarea, select").count();
    console.log("inputs in edit:", inputs);
  }
});

test("D5 task instance detail — graded submission visibility", async ({ page }) => {
  attachConsole(page, "subm");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/instances/${INSTANCE_GRADED}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D5-inst-detail");

  const body = (await page.locator("body").textContent()) ?? "";
  console.log("instance text excerpt:", body.slice(0, 1500).replace(/\s+/g, " "));

  // links to submissions?
  const links = await page.locator("a, button").allTextContents();
  const submLinks = links.filter((t) => /提交|批改|查看|学生/.test(t));
  console.log("submission-related links:", submLinks.slice(0, 20));

  // Insights link
  await page.goto(`${BASE}/teacher/instances/${INSTANCE_GRADED}/insights`).catch(() => null);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D5-inst-insights");
  const insBody = (await page.locator("body").textContent()) ?? "";
  console.log("insights body excerpt:", insBody.slice(0, 1200).replace(/\s+/g, " "));
});

test("D6 collab course (e6fc...) — molly views teacher1's course", async ({ page }) => {
  attachConsole(page, "collab");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/courses/${COLLAB_COURSE_A}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D6-collab-course");

  const body = (await page.locator("body").textContent()) ?? "";
  console.log("collab course excerpt:", body.slice(0, 1200).replace(/\s+/g, " "));

  const tabs = await page.locator('[role="tab"]').allTextContents();
  console.log("collab tabs:", tabs);

  // collaborator-only restrictions?
  const buttons = await page.locator("button, [role='button']").allTextContents();
  const ownerActions = buttons.filter((b) => /删除|归档|协作|班级|学期/.test(b));
  console.log("owner-only actions visible:", ownerActions);

  // Try editing context (collaborator vs owner?)
  const ctxTab = page.locator('[role="tab"]:has-text("教学上下文")').first();
  if (await ctxTab.count()) {
    await ctxTab.click();
    await page.waitForTimeout(1000);
    await shot(page, "D6-collab-context-tab");
    const cBody = (await page.locator("body").textContent()) ?? "";
    const cBtns = await page.locator("button, [role='button']").allTextContents();
    console.log("collab context btns:", cBtns.filter((b) => /上传|删除|编辑|添加/.test(b)));
  }
});

test("D7 weekly insight modal — open without forcing", async ({ page }) => {
  attachConsole(page, "weekly");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});

  // Click "一周洞察" link or button to open modal — does not necessarily trigger generation
  const weekly = page.getByRole("button", { name: /一周洞察|本周|周报|生成/ }).first();
  console.log("weekly insight btn:", await weekly.count(), "label:", await weekly.first().textContent().catch(() => ""));

  if (await weekly.count()) {
    await weekly.click().catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, "D7-weekly-modal");
    const body = (await page.locator("body").textContent()) ?? "";
    console.log("weekly modal excerpt:", body.slice(0, 1200).replace(/\s+/g, " "));

    // Look for "重新生成" / "Refresh" / "force" indicators
    const buttons = await page.locator("button, [role='button']").allTextContents();
    const action = buttons.filter((b) => /生成|刷新|重新/.test(b));
    console.log("weekly modal actions:", action);

    // Cache indicators
    const cachedHint = /缓存|cached|刚刚|分钟前|小时前/.test(body);
    console.log("cache hint:", cachedHint);

    // Token / model / latency indicators
    const meta = /token|耗时|模型|model/i.test(body);
    console.log("meta indicators:", meta);
  }
});

test("D8 ai-settings + ai-assistant + collaborator dialog probe", async ({ page }) => {
  attachConsole(page, "aifeat");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/ai-settings`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D8-ai-settings");
  const aBody = (await page.locator("body").textContent()) ?? "";
  console.log("ai-settings excerpt:", aBody.slice(0, 1000).replace(/\s+/g, " "));

  await page.goto(`${BASE}/teacher/ai-assistant`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "D8-ai-assistant");
  const aaBody = (await page.locator("body").textContent()) ?? "";
  console.log("ai-assistant excerpt:", aaBody.slice(0, 1000).replace(/\s+/g, " "));

  // Course-level — open collaborator dialog
  await page.goto(`${BASE}/teacher/courses/${MOLLY_OWN_COURSE}`);
  await page.waitForLoadState("networkidle").catch(() => {});

  const collabBtn = page.locator("button:has-text('协作教师'), button:has-text('协作')").first();
  console.log("collab btn count:", await collabBtn.count());
  if (await collabBtn.count()) {
    await collabBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "D8-collab-dialog");
    const dBody = (await page.locator("body").textContent()) ?? "";
    console.log("collab dialog excerpt:", dBody.slice(0, 1000).replace(/\s+/g, " "));
  }

  // Add class dialog
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const classBtn = page.locator("button:has-text('添加班级'), button:has-text('班级')").first();
  console.log("class btn count:", await classBtn.count());
  if (await classBtn.count()) {
    await classBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "D8-class-dialog");
  }
});

test("D9 try simulation/quiz/subjective wizard via context menu / right-click", async ({ page }) => {
  attachConsole(page, "wizard");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/courses/${MOLLY_OWN_COURSE}`);
  await page.waitForLoadState("networkidle").catch(() => {});

  // Click chapter outline cells (grid for 课前/课中/课后)
  const cells = await page.locator(".grid, [data-grid], [role='gridcell']").count();
  console.log("grid cells:", cells);

  // Look for + or 新建 in body
  const allText = await page.locator("body").innerHTML();
  const plusMatches = allText.match(/\+(?=[^<]{0,30}(任务|添加|新建|测验|模拟|主观))/g);
  console.log("plus context matches:", plusMatches);

  // Try to find buttons with title attr
  const allButtons = await page.locator("button[title]").evaluateAll((els) =>
    els.map((e) => ({ title: e.getAttribute("title"), text: e.textContent?.slice(0, 30) }))
  );
  console.log("button[title] count:", allButtons.length);
  for (const b of allButtons.slice(0, 30)) console.log("  btn[title]:", JSON.stringify(b));
});

test("D10 sample API responses + audit log routes", async ({ page, context }) => {
  attachConsole(page, "api");
  await login(page, "molly@qq.com", "123456");

  const apis = [
    "/api/teacher/dashboard",
    "/api/teacher/dashboard/weekly-insight",
    "/api/teacher/tasks",
    "/api/teacher/instances",
    "/api/teacher/courses",
    "/api/teacher/analytics-v2/overview",
    "/api/admin/audit-logs",
    "/api/lms/ai-runs",
    "/api/ai/runs",
    "/api/tasks/wizard",
    "/api/teacher/courses/" + MOLLY_OWN_COURSE,
  ];
  for (const u of apis) {
    const resp = await page.request.get(`${BASE}${u}`).catch(() => null);
    const st = resp?.status() ?? -1;
    const len = (await resp?.text().catch(() => ""))?.length ?? 0;
    console.log(`API ${u} → ${st} len=${len}`);
  }
});
