/**
 * Bug-probe teacher (molly) — full functional sweep.
 * READ-ONLY: no creates, edits, deletes.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3000";
const SS = path.resolve(process.cwd(), ".harness/screenshots/bug-probe-teacher");
const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef"; // 个人规划 (molly owned)
const TASK_IDS = [
  "e07a8ba8-6ee1-4d57-836b-a4847296f376", // PDF导入测验
  "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", // 深度测试
  "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", // 个人理财基础概念测验
];
const INSTANCE_IDS = [
  "7db59a62-e806-44c6-b102-e767f61ed8bb",
  "a7d9b380-49fd-4ce2-9d95-000935ac0c5a",
  "449ae28c-8913-43f5-adda-dc296885071b",
];

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
    if (m.type() === "error" || m.type() === "warning") {
      console.log(`[${label} ${m.type()}]`, m.text().slice(0, 280));
    }
  });
  page.on("pageerror", (e) => console.log(`[${label} pageerror]`, e.message.slice(0, 280)));
  page.on("response", (r) => {
    if (r.status() >= 400) {
      console.log(`[${label} http ${r.status()}]`, r.url().slice(0, 200));
    }
  });
}

test.setTimeout(180_000);

test("01 dashboard + weekly insight", async ({ page }) => {
  attachConsole(page, "dash");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "01-dashboard");
  console.log("dash url:", page.url());

  // Buttons / sections present
  const txt = (await page.locator("body").textContent()) ?? "";
  console.log("dash text excerpt:", txt.slice(0, 600).replace(/\s+/g, " "));

  // Weekly insight CTA
  const weeklyBtn = page.getByRole("button", { name: /一周洞察|生成一周|周报|本周/ });
  console.log("weekly btn count:", await weeklyBtn.count());

  // Don't trigger AI generation (cost); just check button state and surrounding info
  if (await weeklyBtn.count()) {
    await weeklyBtn.first().scrollIntoViewIfNeeded();
    await shot(page, "01b-weekly-button");
  }
});

test("02 course list + 个人规划 detail tabs", async ({ page }) => {
  attachConsole(page, "course");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/courses`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "02-courses-list");
  console.log("courses url:", page.url());

  const listText = (await page.locator("body").textContent()) ?? "";
  console.log("courses list excerpt:", listText.slice(0, 600).replace(/\s+/g, " "));

  // Look for delete/archive buttons on list
  const buttons = await page.locator("button, [role='button']").allTextContents();
  const adminButtons = buttons.filter((b) => /删除|归档|复制|导出/.test(b));
  console.log("course-list admin buttons:", adminButtons);

  // Detail tabs
  await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "02b-course-detail");

  const tabs = await page.locator('[role="tab"]').allTextContents();
  console.log("course detail tabs:", tabs);

  // Capture each tab
  for (const tab of tabs) {
    const el = page.locator(`[role="tab"]:has-text("${tab}")`).first();
    await el.click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, `02-tab-${tab.replace(/[\s\/]/g, "_")}`);
    // Look for delete/archive in this tab
    const tabBtns = await page.locator("button, [role='button']").allTextContents();
    const dels = tabBtns.filter((b) => /删除|归档|复制/.test(b));
    if (dels.length) console.log(`tab ${tab} admin btns:`, dels);
  }
});

test("03 task wizard entry points", async ({ page }) => {
  attachConsole(page, "wizard");
  await login(page, "molly@qq.com", "123456");

  // Old route /teacher/tasks/new
  await page.goto(`${BASE}/teacher/tasks/new`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "03-tasks-new");
  console.log("/teacher/tasks/new url:", page.url(), "title:", await page.title());

  // Browse to course detail and look for task creation entries
  await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const wizBtns = await page.locator("button, [role='button'], a").allTextContents();
  const create = wizBtns.filter((b) => /新建任务|创建任务|添加任务|出题|测验|主观|模拟|建任务|新任务/.test(b));
  console.log("create-task entry candidates:", create);
});

test("04 instance list + open/close state machine probe", async ({ page }) => {
  attachConsole(page, "inst");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/instances`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "04-instances");
  console.log("instances url:", page.url());

  const listText = (await page.locator("body").textContent()) ?? "";
  console.log("instances list excerpt:", listText.slice(0, 1200).replace(/\s+/g, " "));

  // Per-instance detail with close/reopen probe
  for (let i = 0; i < INSTANCE_IDS.length; i++) {
    const id = INSTANCE_IDS[i];
    await page.goto(`${BASE}/teacher/instances/${id}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await shot(page, `04-inst-${i + 1}`);

    const buttons = await page.locator("button, [role='button']").allTextContents();
    const closeBtns = buttons.filter((b) => /关闭|结束|停止|重新开放|重启|reopen/i.test(b));
    const editBtns = buttons.filter((b) => /编辑|修改|更新/.test(b));
    const delBtns = buttons.filter((b) => /删除/.test(b));
    const releaseBtns = buttons.filter((b) => /公布|发放|释放|release/.test(b));
    console.log(`inst ${i + 1} buttons: close=${JSON.stringify(closeBtns)} edit=${JSON.stringify(editBtns)} del=${JSON.stringify(delBtns)} release=${JSON.stringify(releaseBtns)}`);
  }
});

test("05 task overview — config completeness + edit capability", async ({ page }) => {
  attachConsole(page, "task");
  await login(page, "molly@qq.com", "123456");

  for (let i = 0; i < TASK_IDS.length; i++) {
    const id = TASK_IDS[i];
    await page.goto(`${BASE}/teacher/tasks/${id}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await shot(page, `05-task-${i + 1}`);

    const body = (await page.locator("body").textContent()) ?? "";
    console.log(`task ${i + 1} url:`, page.url());
    console.log(`task ${i + 1} text 500:`, body.slice(0, 500).replace(/\s+/g, " "));

    const buttons = await page.locator("button, [role='button']").allTextContents();
    const editBtns = buttons.filter((b) => /编辑|修改|配置|改/.test(b));
    const dupBtns = buttons.filter((b) => /复制|克隆|另存/.test(b));
    const delBtns = buttons.filter((b) => /删除/.test(b));
    console.log(`task ${i + 1} edit btns: ${JSON.stringify(editBtns.slice(0, 6))} dup: ${JSON.stringify(dupBtns)} del: ${JSON.stringify(delBtns)}`);

    // Look for rubric / AI persona / question / due / class / knowledge tags
    const hasRubric = /量规|rubric|评分标准|评分维度/.test(body);
    const hasPersona = /AI 客户|客户人设|persona|AI客户/.test(body);
    const hasQuestions = /题目|题号|选项|题干/.test(body);
    const hasClasses = /班级/.test(body);
    const hasKnowledge = /知识点|知识标签/.test(body);
    console.log(`task ${i + 1} sections present: rubric=${hasRubric} persona=${hasPersona} questions=${hasQuestions} classes=${hasClasses} knowledge=${hasKnowledge}`);
  }
});

test("06 analytics-v2 default scope + KPI hydration", async ({ page }) => {
  attachConsole(page, "av2");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "06-analytics-v2");

  console.log("av2 url:", page.url());
  const body = (await page.locator("body").textContent()) ?? "";
  console.log("av2 excerpt:", body.slice(0, 800).replace(/\s+/g, " "));

  const empty = /暂无数据|无数据|尚未|没有数据|当前还没有/.test(body);
  const has4 = /知识|技能|教学|焦点|nextSteps|下一步|建议/.test(body);
  console.log("av2 empty:", empty, "has-4dims:", has4);

  // try scope selector
  const scope = page.locator('button:has-text("课程"), [role="combobox"]').first();
  console.log("scope ctrl count:", await scope.count());
});

test("07 admin/audit/ai-usage URL inventory", async ({ page }) => {
  attachConsole(page, "admin");
  await login(page, "molly@qq.com", "123456");

  const urls = [
    "/teacher/ai-usage",
    "/teacher/ai-runs",
    "/admin",
    "/admin/audit",
    "/admin/audit-logs",
    "/teacher/audit",
    "/teacher/admin",
    "/teacher/ai-settings",
  ];
  for (const u of urls) {
    const resp = await page.goto(`${BASE}${u}`, { waitUntil: "domcontentloaded" }).catch(() => null);
    const status = resp?.status() ?? -1;
    console.log(`url ${u} → ${status} (final: ${page.url()})`);
    await shot(page, `07-${u.replace(/\//g, "_")}`);
  }
});

test("08 study buddy teacher view", async ({ page }) => {
  attachConsole(page, "sb");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle").catch(() => {});

  const tabs = await page.locator('[role="tab"]').allTextContents();
  const sbTab = tabs.find((t) => /学习伴|Buddy|学伴|社区|讨论/.test(t));
  console.log("course tabs:", tabs, "sb tab match:", sbTab);

  if (sbTab) {
    await page.locator(`[role="tab"]:has-text("${sbTab}")`).first().click();
    await page.waitForTimeout(1500);
    await shot(page, "08-study-buddy");
    const body = (await page.locator("body").textContent()) ?? "";
    console.log("sb tab body excerpt:", body.slice(0, 800).replace(/\s+/g, " "));
    const btns = await page.locator("button, [role='button']").allTextContents();
    const delBtns = btns.filter((b) => /删除|隐藏|下架/.test(b));
    console.log("sb tab delete btns:", delBtns);
  }
});

test("09 delete/archive inventory across modules", async ({ page }) => {
  attachConsole(page, "del");
  await login(page, "molly@qq.com", "123456");

  // course list
  await page.goto(`${BASE}/teacher/courses`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const cBtns = await page.locator("button, [role='button']").allTextContents();
  console.log("course-list deletes:", cBtns.filter((b) => /删除|归档/.test(b)));

  // each course tab buttons (delete) — already in test 02

  // task instance list
  await page.goto(`${BASE}/teacher/instances`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const iBtns = await page.locator("button, [role='button']").allTextContents();
  console.log("instance-list deletes:", iBtns.filter((b) => /删除|归档/.test(b)));

  // task list (try /teacher/tasks; may be no such page)
  const resp = await page.goto(`${BASE}/teacher/tasks`, { waitUntil: "domcontentloaded" }).catch(() => null);
  console.log("/teacher/tasks status:", resp?.status(), "final:", page.url());
  await shot(page, "09-tasks-index");

  // groups / classes
  await page.goto(`${BASE}/teacher/groups`).catch(() => null);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "09-groups");
  const gBody = (await page.locator("body").textContent()) ?? "";
  console.log("groups excerpt:", gBody.slice(0, 400).replace(/\s+/g, " "));
});

test("10 schedule + announcements + ai-assistant + ai-settings + analytics(v1)", async ({ page }) => {
  attachConsole(page, "misc");
  await login(page, "molly@qq.com", "123456");

  const pages = ["/teacher/schedule", "/teacher/announcements", "/teacher/ai-assistant", "/teacher/ai-settings", "/teacher/analytics"];
  for (const p of pages) {
    const resp = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" }).catch(() => null);
    console.log(`${p} → ${resp?.status()} final ${page.url()}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await shot(page, `10-${p.replace(/\//g, "_")}`);
  }
});

test("11 task wizard probe — open each variant via course tab", async ({ page }) => {
  attachConsole(page, "wiz");
  await login(page, "molly@qq.com", "123456");

  await page.goto(`${BASE}/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);

  const wizBtns = await page.locator("button, [role='button']").allTextContents();
  const candidates = wizBtns.filter((b) => /新建任务|创建任务|添加任务|新任务|出题|建任务|\+任务/.test(b));
  console.log("create-task buttons:", candidates);

  // Try clicking the first one if any
  if (candidates.length) {
    const btn = page.locator(`button:has-text("${candidates[0]}"), [role='button']:has-text("${candidates[0]}")`).first();
    await btn.click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "11-wizard-open-1");
    const body = (await page.locator("body").textContent()) ?? "";
    console.log("wizard step excerpt:", body.slice(0, 800).replace(/\s+/g, " "));
  } else {
    // Try grid +block buttons
    const plus = await page.locator("button:has-text('+')").allTextContents();
    console.log("plus buttons:", plus);
  }
});
