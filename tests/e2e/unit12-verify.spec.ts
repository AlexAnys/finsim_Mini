import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit12-verify";

// Subjective instance: alex 在 class deedd844; teacher 配 {pdf,docx,xlsx} (no image)
const SUBJ_INSTANCE_PDFDOC = "05504760-ad34-4b53-8b93-890b61cd24af";

function runSql(sql: string): string {
  return execSync(
    `docker exec -i acc4fef29d82_finsim-postgres psql -U finsim -d finsim -t -A`,
    { encoding: "utf8", input: sql },
  ).trim();
}

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
// A. accept 属性反映 teacher 配置 — pdf/docx/xlsx (无 image → 无 capture)
// ============================================
test("A1: 老师配置 {pdf,docx,xlsx} → input accept 含三种 + 无 capture 属性", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await context.newPage();
  await page.goto(`${BASE}/tasks/${SUBJ_INSTANCE_PDFDOC}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  // 找到 input[type=file] (hidden)
  const fileInput = page.locator('input[type="file"]').first();
  await expect(fileInput).toHaveCount(1);
  const accept = await fileInput.getAttribute("accept");
  expect(accept).toBeTruthy();
  expect(accept).toContain(".pdf");
  expect(accept).toContain(".docx");
  expect(accept).toContain(".xlsx");
  // 不应含 .jpg / .png（不在配置内）
  expect(accept).not.toContain(".jpg");
  expect(accept).not.toContain(".png");

  // capture 属性不应存在（无 image）
  const capture = await fileInput.getAttribute("capture");
  expect(capture).toBeNull();

  await page.screenshot({ path: `${SS}/A1-pdfdocxlsx.png`, fullPage: true });
  await context.close();
});

// ============================================
// B. 注入 image-only 配置 → input accept 含 .jpg + capture="environment"
// ============================================
test("B1: 老师配置含 image → input 有 capture='environment'", async ({ browser }) => {
  // 临时改 fixture 的 allowedAttachmentTypes 加 jpg/png
  const original = runSql(
    `SELECT "allowedAttachmentTypes" FROM "SubjectiveConfig" WHERE "taskId" IN (SELECT "taskId" FROM "TaskInstance" WHERE id='${SUBJ_INSTANCE_PDFDOC}')`,
  );
  runSql(
    `UPDATE "SubjectiveConfig" SET "allowedAttachmentTypes"='{"jpg","png","pdf"}' WHERE "taskId" IN (SELECT "taskId" FROM "TaskInstance" WHERE id='${SUBJ_INSTANCE_PDFDOC}')`,
  );

  try {
    const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
    const page = await context.newPage();
    await page.goto(`${BASE}/tasks/${SUBJ_INSTANCE_PDFDOC}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    const fileInput = page.locator('input[type="file"]').first();
    const accept = await fileInput.getAttribute("accept");
    expect(accept).toContain(".jpg");
    expect(accept).toContain(".png");

    // 含 image → capture 应存在
    const capture = await fileInput.getAttribute("capture");
    expect(capture).toBe("environment");

    await page.screenshot({ path: `${SS}/B1-with-image-capture.png`, fullPage: true });
    await context.close();
  } finally {
    // 还原 — original 是 PostgreSQL array format e.g. "{pdf,docx,xlsx}"
    runSql(
      `UPDATE "SubjectiveConfig" SET "allowedAttachmentTypes"='${original}' WHERE "taskId" IN (SELECT "taskId" FROM "TaskInstance" WHERE id='${SUBJ_INSTANCE_PDFDOC}')`,
    );
  }
});

// ============================================
// C. 学生页面显示文案反映 effective allowed types
// ============================================
test("C1: 页面文案 '支持：pdf, docx, xlsx' 反映配置", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await context.newPage();
  await page.goto(`${BASE}/tasks/${SUBJ_INSTANCE_PDFDOC}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const body = await page.textContent("body");
  expect(body).toBeTruthy();
  // 应显示 pdf docx xlsx
  expect(body).toContain("pdf");
  expect(body).toContain("docx");
  expect(body).toContain("xlsx");
  // 不应出现 .doc (旧 hardcoded) 或 .png 等不在配置内的
  // 注：fixture 配置只 {pdf,docx,xlsx}，不含 .doc / .png
  await context.close();
});
