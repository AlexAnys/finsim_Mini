import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "http://localhost:3000";

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
// ① modal 移动端：375px 视口下 modal DOM 含 w-[calc(100vw-1rem)] className
// ============================================
test("A1: weekly-insight-modal source 含 'w-[calc(100vw-1rem)]' 与 sm:max-w-3xl 移动端响应式", () => {
  const root = resolve(__dirname, "../..");
  const src = readFileSync(
    resolve(root, "components/teacher-dashboard/weekly-insight-modal.tsx"),
    "utf8",
  );
  expect(src).toContain("w-[calc(100vw-1rem)]");
  expect(src).toContain("sm:max-w-3xl");
  expect(src).toContain("max-h-[90vh]");
});

// ============================================
// ② 按钮字号 10.5 → 12
// ============================================
test("B1: inline-section-row +任务/+块 按钮使用 text-[12px]", () => {
  const root = resolve(__dirname, "../..");
  const src = readFileSync(
    resolve(root, "components/teacher-course-edit/inline-section-row.tsx"),
    "utf8",
  );
  // 旧 text-[10.5px] 应被替换
  // 仍有其他地方用 10.5px（如教师协作 badge），但本 file 两个 +任务/+块 按钮应是 12px
  // 通过 grep 直接验证 text-[12px] 出现至少 2 次（add 任务 + add 块）
  const count12 = (src.match(/text-\[12px\]/g) ?? []).length;
  expect(count12).toBeGreaterThanOrEqual(2);
});

test("B2: block-edit-panel 新建块 文案 text-[12px]", () => {
  const root = resolve(__dirname, "../..");
  const src = readFileSync(
    resolve(root, "components/teacher-course-edit/block-edit-panel.tsx"),
    "utf8",
  );
  expect(src).toContain('<span className="text-[12px]">新建块</span>');
});

// ============================================
// ③ KS owner-confirm AlertDialog (不再 window.confirm)
// ============================================
test("C1: context-sources-panel 不再使用 window.confirm，改 AlertDialog", () => {
  const root = resolve(__dirname, "../..");
  const src = readFileSync(
    resolve(root, "components/course/context-sources-panel.tsx"),
    "utf8",
  );
  // 应该有 AlertDialog import + setConfirmOwnerSourceId state
  expect(src).toContain("AlertDialogTitle");
  expect(src).toContain("setConfirmOwnerSourceId");
  expect(src).toContain("删除其他老师上传的素材");
  // owner-confirm 路径不再使用 window.confirm() 调用（注：注释中的 'window.confirm' 文字允许存在作为历史说明）
  expect(src).not.toMatch(/window\.confirm\(/);
});

// ============================================
// ④ /teacher/analytics → /teacher/analytics-v2 redirect 验证
// ============================================
test("D1: /teacher/analytics redirects to /teacher/analytics-v2 (Next.js redirect)", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "teacher1@finsim.edu.cn", "password123");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/analytics`);
  // wait redirect
  await page.waitForURL((u) => u.pathname === "/teacher/analytics-v2", { timeout: 10_000 });
  const url = page.url();
  expect(url).toContain("/teacher/analytics-v2");

  await context.close();
});
