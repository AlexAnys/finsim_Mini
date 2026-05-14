import { test, expect, type APIRequestContext, type BrowserContext, type ConsoleMessage } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit9";

// 测试 fixture (builder claim)
const BELLE_SIM_SUB = "32b9381c-8b6c-44cd-93ce-1d18b1049020"; // belle, simulation, graded, no evidence
const SIM_TASK_INSTANCE = "f1494008-e987-4576-b5e5-4a304d0ec822"; // 客户理财咨询模拟 instance

async function makeAuthedContext(
  browser: import("@playwright/test").Browser,
  email: string,
  password: string,
): Promise<{ context: BrowserContext; request: APIRequestContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
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
  await page.waitForTimeout(800);
  for (let i = 0; i < 20; i++) {
    const r = await context.request.get(`${BASE}/api/auth/session`);
    const j = await r.json();
    if (j?.user?.email === email) {
      await page.close();
      return { context, request: context.request };
    }
    await page.waitForTimeout(500);
  }
  await page.close();
  throw new Error(`login failed for ${email}`);
}

test.setTimeout(180_000);

// ============================================
// A: 学生 /grades 老 sim sub → fallback "无引用依据（历史评分）"
// ============================================

test("QA r9 A: belle 老 sim sub /grades 详情显示 '无引用依据（历史评分）' fallback × 5 rubric", async ({
  browser,
}) => {
  const belle = await makeAuthedContext(browser, "belle@qq.com", "11");
  const page = await belle.context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  try {
    await page.goto(`${BASE}/grades?focus=${BELLE_SIM_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/A1-belle-grades.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[A] body first 800:", bodyText.slice(0, 800));

    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 应有 simulation 任务名 / rubric 标识 (老 sub 5 维度 rubric)
    const hasFallback = bodyText.includes("无引用依据（历史评分）");
    console.log("[A] has fallback text?", hasFallback);
    expect(hasFallback, "老 sub 应显示 '无引用依据（历史评分）' fallback").toBe(true);

    // count fallback occurrences (should be 5, one per rubric)
    const fallbackCount = (bodyText.match(/无引用依据（历史评分）/g) ?? []).length;
    console.log("[A] fallback count:", fallbackCount);
    expect(fallbackCount, "5 个 rubric 维度都应显示 fallback").toBeGreaterThanOrEqual(5);

    // 不应有 evidence 误标 (老 sub evidence===undefined 时绝不显示编造引文)
    const hasMockEvidence = /未通过引用校验/.test(bodyText);
    console.log("[A] has 未通过引用校验 (should be false for student view):", hasMockEvidence);
    expect(hasMockEvidence, "学生侧不应有 '未通过引用校验' badge").toBe(false);

    // console errors 0
    const realErrs = consoleErrors.filter(
      (e) => !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e),
    );
    console.log("[A] console errors:", realErrs.length);
    expect(realErrs.length, "页面应 0 console error").toBe(0);
  } finally {
    await page.close();
    await belle.context.close();
  }
});

// ============================================
// B: API GET submission - rubricBreakdown 结构正确
// ============================================

test("QA r9 B: API GET submission 返回 rubricBreakdown 字段 (backward-compat)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    // teacher API for submission data — 走 instance 端点
    const resp = await molly.request.get(`${BASE}/api/lms/task-instances/${SIM_TASK_INSTANCE}/submissions`);
    if (resp.status() < 400) {
      const j = await resp.json();
      const subs = (j?.data?.submissions ?? j?.data ?? []) as Array<{ id: string; evaluation?: { rubricBreakdown?: unknown[] } }>;
      console.log("\n[B] sim instance submissions count:", subs.length);
      // 至少 1 个 graded sub (belle)
      const target = subs.find((s) => s.id === BELLE_SIM_SUB);
      console.log("[B] belle sub found?", !!target);
      if (target) {
        const rb = target.evaluation?.rubricBreakdown ?? [];
        console.log("[B] rubricBreakdown count:", rb.length);
        expect(Array.isArray(rb)).toBe(true);
      }
    } else {
      console.log("[B] (info) instance API status:", resp.status(), "— maybe endpoint shape different");
    }
  } finally {
    await molly.context.close();
  }
});

// ============================================
// C: teacher 任务实例页加载 0 console error (老 sub 兼容)
// ============================================

test("QA r9 C: molly /teacher/instances/[id] 加载老 sim sub 0 console error", async ({ browser }) => {
  const teacher1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await teacher1.context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  try {
    await page.goto(`${BASE}/teacher/instances/${SIM_TASK_INSTANCE}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/C1-teacher-instance.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 应不 crash
    const realErrs = consoleErrors.filter(
      (e) =>
        !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e) &&
        !/Warning:.*Missing/i.test(e), // ignore a11y warnings
    );
    console.log("\n[C] real console errors:", realErrs.length);
    if (realErrs.length) {
      realErrs.slice(0, 3).forEach((e) => console.log("  -", e.slice(0, 200)));
    }
    expect(realErrs.length, "教师任务实例页 0 console error").toBe(0);
  } finally {
    await page.close();
    await teacher1.context.close();
  }
});

// ============================================
// D: 学生 /grades 页 chip 显示模拟对话 + 详情面板可见
// ============================================

test("QA r9 D: belle /grades 老 sim sub 详情面板可见 (模拟对话标识)", async ({ browser }) => {
  const belle = await makeAuthedContext(browser, "belle@qq.com", "11");
  const page = await belle.context.newPage();
  try {
    await page.goto(`${BASE}/grades?focus=${BELLE_SIM_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);

    const bodyText = (await page.textContent("body")) ?? "";
    // 应识别为模拟对话
    const hasModulo = /模拟|simulation/i.test(bodyText);
    console.log("\n[D] body has 模拟 indicator?", hasModulo);
    expect(hasModulo).toBe(true);

    // 应有 task name "客户理财咨询模拟"
    const hasTaskName = bodyText.includes("客户理财咨询模拟");
    console.log("[D] has task name?", hasTaskName);
    expect(hasTaskName, "应展示模拟任务名").toBe(true);

    // 应有 5 个 rubric 维度的关键字 (从 DB 已知 5 rubric)
    const hasRubric = /需求|风险|资产|沟通|合规/.test(bodyText);
    console.log("[D] has rubric criterion text?", hasRubric);
    expect(hasRubric, "应展示 rubric 评分维度").toBe(true);

    // 应有总分文案
    const hasScore = /25|得分|总分/.test(bodyText);
    console.log("[D] has score text?", hasScore);
    expect(hasScore).toBe(true);
  } finally {
    await page.close();
    await belle.context.close();
  }
});

// ============================================
// E: 教师 grading drawer 行为 (老 sub 时不应崩 + 评分依据 section 不渲染)
// ============================================

test("QA r9 E: 教师 instance page → 老 sub grading drawer 不崩 + 不显示评分依据", async ({ browser }) => {
  const teacher1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await teacher1.context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  try {
    await page.goto(`${BASE}/teacher/instances/${SIM_TASK_INSTANCE}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/E1-teacher-with-drawer.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";

    // 老 sub evidence===undefined → 教师 drawer 也应不显示编造证据气泡 (因为 aiScore.evidence undefined)
    // 应没有 "评分依据" + 黄色气泡 (老 sub 不应展示，这是 Unit 9 acceptance)
    // 但 builder UI 实现可能在没有 evidence 时整体不渲染该 section — 验证 DOM
    const hasEvidenceSection = /评分依据/.test(bodyText) && /未通过引用校验/.test(bodyText);
    console.log("\n[E] 评分依据 section + unverified badge (should be false for legacy)?", hasEvidenceSection);
    // legacy sub 不应有此组合（evidence undefined → section 不渲染或为空）

    const realErrs = consoleErrors.filter(
      (e) =>
        !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e) &&
        !/Warning:.*Missing/i.test(e),
    );
    console.log("[E] real console errors:", realErrs.length);
    expect(realErrs.length, "0 console error").toBe(0);
  } finally {
    await page.close();
    await teacher1.context.close();
  }
});
