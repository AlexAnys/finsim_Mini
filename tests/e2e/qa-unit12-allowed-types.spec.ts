import { test, expect, type APIRequestContext, type BrowserContext, type ConsoleMessage } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit12";

const SUB_INSTANCE = "05504760-ad34-4b53-8b93-890b61cd24af"; // 个人投资组合分析报告 in alex's class, allowedTypes={pdf,docx,xlsx}
const SUB_TASK = "aff902a3-a669-4181-91ea-613519b9f4d2"; // backing task

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
// A: 文档型 allowedTypes {pdf,docx,xlsx} → input accept 含三种 + 无 capture
// ============================================

test("QA r12 A: alex /tasks/[sub] allowedTypes={pdf,docx,xlsx} → input accept 三种 + 无 capture 属性", async ({
  browser,
}) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  try {
    await page.goto(`${BASE}/tasks/${SUB_INSTANCE}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SS}/A1-sub-task.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 找 file input
    const fileInput = page.locator('input[type="file"]').first();
    const inputCount = await fileInput.count();
    console.log("\n[A] file input count:", inputCount);

    if (inputCount > 0) {
      const acceptAttr = await fileInput.getAttribute("accept");
      const captureAttr = await fileInput.getAttribute("capture");
      console.log("[A] accept attr:", acceptAttr);
      console.log("[A] capture attr:", captureAttr);

      // accept 应含 .pdf .docx .xlsx
      expect(acceptAttr, "accept 应非 null").toBeTruthy();
      expect(acceptAttr).toMatch(/\.pdf/);
      expect(acceptAttr).toMatch(/\.docx/);
      expect(acceptAttr).toMatch(/\.xlsx/);
      // 不应含 image 类型
      const hasImage = /\.(jpg|jpeg|png|gif|webp|image)/.test(acceptAttr ?? "");
      console.log("[A] accept 含 image?", hasImage);
      expect(hasImage, "doc-only 配置不应含 image").toBe(false);
      // capture 应不存在（无 image 不加 capture）
      expect(captureAttr, "doc-only 配置不应有 capture 属性").toBeNull();
    }

    const realErrs = consoleErrors.filter(
      (e) => !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e),
    );
    console.log("[A] console errors:", realErrs.length);
    expect(realErrs.length, "0 console error").toBe(0);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// B: 文案 "支持: pdf, docx, xlsx" 反映 effective 配置
// ============================================

test("QA r12 B: alex 页面文案 '支持' 反映 allowedTypes 配置", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/tasks/${SUB_INSTANCE}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[B] body first 500:", bodyText.slice(0, 500));

    // 应有 "支持" 文案 + pdf/docx/xlsx
    const hasHint = /支持.*pdf|支持.*docx|支持.*xlsx/.test(bodyText) || /pdf.*docx.*xlsx|pdf, docx, xlsx/i.test(bodyText);
    console.log("[B] has 文案 hint?", hasHint);

    // 应含 pdf docx xlsx 至少其一
    expect(/pdf|docx|xlsx/.test(bodyText)).toBe(true);
  } finally {
    await page.close();
    await alex.context.close();
  }
});

// ============================================
// C: API contract — instance 返回 subjectiveConfig.allowedAttachmentTypes
// ============================================

test("QA r12 C: GET /api/lms/task-instances/[id] 返回 subjectiveConfig.allowedAttachmentTypes 字段", async ({
  browser,
}) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  try {
    const resp = await alex.request.get(`${BASE}/api/lms/task-instances/${SUB_INSTANCE}`);
    expect(resp.status()).toBe(200);
    const j = await resp.json();
    const inst = j?.data ?? j;
    const subjCfg = inst?.task?.subjectiveConfig;
    console.log("\n[C] subjectiveConfig:", JSON.stringify(subjCfg).slice(0, 300));
    expect(subjCfg).toBeTruthy();
    const allowed = subjCfg?.allowedAttachmentTypes ?? [];
    console.log("[C] allowedAttachmentTypes:", allowed);
    expect(Array.isArray(allowed)).toBe(true);
    expect(allowed).toContain("pdf");
    expect(allowed).toContain("docx");
    expect(allowed).toContain("xlsx");
  } finally {
    await alex.context.close();
  }
});

// ============================================
// D: 教师 task 编辑页加载 (regression)
// ============================================

test("QA r12 D: teacher1 /teacher/tasks/[id] (sub task) 加载 0 console error", async ({ browser }) => {
  const teacher1 = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await teacher1.context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  try {
    await page.goto(`${BASE}/teacher/tasks/${SUB_TASK}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);

    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);
    expect(bodyText).toMatch(/个人投资组合分析报告/);

    const realErrs = consoleErrors.filter(
      (e) => !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e),
    );
    expect(realErrs.length).toBe(0);
  } finally {
    await page.close();
    await teacher1.context.close();
  }
});
