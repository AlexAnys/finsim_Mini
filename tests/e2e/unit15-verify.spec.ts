import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit15-verify";

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
// A1: teacher2 (0 graded submissions) → API 返回 emptyState=true + 不调 AI
// ============================================
test("A1: teacher2 (0 graded subs) → emptyState=true / modelUsed=null / durationMs=0", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");

  const res = await request.get(`${BASE}/api/lms/weekly-insight?force=true`);
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.success).toBe(true);
  expect(json.data.submissionCount).toBe(0);
  expect(json.data.payload.emptyState).toBe(true);
  expect(json.data.modelUsed).toBeNull();
  expect(json.data.durationMs).toBe(0);
  expect(json.data.payload.highlightSummary).toContain("尚无");
  expect(json.data.payload.weakConceptsByCourse).toEqual([]);
  expect(json.data.payload.classDifferences).toEqual([]);
  expect(json.data.payload.studentClusters).toEqual([]);
  expect(json.data.payload.upcomingClassRecommendations).toEqual([]);

  void runSql;
  await context.close();
});

// ============================================
// B1: modal 显示 emptyState CTA 卡 + "去管理任务实例"按钮
// ============================================
test("B1: teacher2 /teacher/dashboard 打开 weekly-insight modal 显示 CTA 卡", async ({ browser }) => {
  const { context } = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");
  const page = await context.newPage();
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  const trigger = page.locator('button:has-text("一周洞察")').first();
  await trigger.click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const body = await page.textContent("body");
  expect(body).toBeTruthy();
  const hasCta =
    body?.includes("本周尚无可聚合数据") ||
    body?.includes("去管理任务实例") ||
    body?.includes("先去任务实例公布学生成绩");
  expect(hasCta).toBe(true);

  await page.screenshot({ path: `${SS}/B1-emptyState-cta.png`, fullPage: true });
  await context.close();
});

// ============================================
// C1: cache 命中后仍显示 emptyState (cache 透传 payload.emptyState)
// ============================================
test("C1: 第二次 GET 命中 cache 仍 emptyState=true", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "teacher2@finsim.edu.cn", "password123");

  // 注意：Unit 11 throttle 60s force=true。如果上一个 case A1 刚 force 过，B1 force 也跑过，
  // 这里不能再 force（会 429）。改为非 force 命中之前生成的 cache。
  const r1 = await request.get(`${BASE}/api/lms/weekly-insight`);
  expect(r1.ok()).toBe(true);
  const j1 = await r1.json();
  expect(j1.data.payload.emptyState).toBe(true);

  // Second fetch (no force) hits cache
  const r2 = await request.get(`${BASE}/api/lms/weekly-insight`);
  expect(r2.ok()).toBe(true);
  const j2 = await r2.json();
  expect(j2.data.cached).toBe(true);
  expect(j2.data.payload.emptyState).toBe(true);
  expect(j2.data.payload.highlightSummary).toContain("尚无");

  await context.close();
});
