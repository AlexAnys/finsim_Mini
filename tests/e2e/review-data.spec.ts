import { test, expect, type Page } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:3000";
const SHOTS = path.resolve(
  __dirname,
  "../../.harness/screenshots/review-2026-05-13/data",
);

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page
      .waitForURL((url) => !/\/login(\?|$)/.test(url.pathname + url.search), { timeout: 25_000 })
      .catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
}

test.setTimeout(180_000);

test("DATA-01 老师 dashboard 数字对比 DB", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/01-teacher-dashboard.png`, fullPage: true });
  const bodyText = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");
  console.log("DATA-01 dashboard body snippet:", bodyText.slice(0, 1200));
});

test("DATA-02 /teacher/analytics-v2 默认视图 + 4 KPI", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/02-analytics-v2-default.png`, fullPage: true });
  const bodyText = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");
  console.log("DATA-02 analytics-v2 body snippet:", bodyText.slice(0, 1800));

  // Look for KPI labels
  const found: Record<string, string> = {};
  for (const label of ["完成率", "归一化均分", "成绩待发布", "风险信号"]) {
    const loc = page.locator(`text=${label}`).first();
    if ((await loc.count()) > 0) {
      const card = loc.locator("xpath=ancestor::*[contains(@class,'rounded') or self::button][1]");
      found[label] = ((await card.textContent()) ?? "").replace(/\s+/g, " ").slice(0, 200);
    }
  }
  console.log("DATA-02 KPIs:", JSON.stringify(found));
});

test("DATA-03 点开 KPI 卡 drilldown", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3500);

  const labels = ["完成率", "归一化均分", "成绩待发布", "风险信号"];
  const out: Array<{ label: string; cardSnippet: string; drawerRows: number; drawerHeading: string }> = [];
  for (const label of labels) {
    const card = page.locator(`button:has-text("${label}")`).first();
    if ((await card.count()) === 0) {
      out.push({ label, cardSnippet: "not_found", drawerRows: -1, drawerHeading: "" });
      continue;
    }
    const cardText = ((await card.textContent()) ?? "").replace(/\s+/g, " ");
    await card.click({ trial: false }).catch(() => {});
    await page.waitForTimeout(1500);
    const drawerHeading = ((await page.locator('[role="dialog"] h2, [role="dialog"] h3').first().textContent().catch(() => "")) ?? "");
    const drawerRows = await page.locator('[role="dialog"] tr, [role="dialog"] li').count();
    await page.screenshot({ path: `${SHOTS}/04-drawer-${label}.png`, fullPage: true });
    out.push({ label, cardSnippet: cardText.slice(0, 160), drawerRows, drawerHeading });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
  }
  console.log("DATA-03 drilldown:", JSON.stringify(out));
});

test("DATA-04 instance insights 单实例", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  const instanceId = "ca3b34d3-815e-49ac-b760-21df5ec4eb74";
  await page.goto(`${BASE}/teacher/instances/${instanceId}/insights`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/05-instance-insights.png`, fullPage: true });
  const bodyText = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");
  console.log("DATA-04 inst-insights snippet:", bodyText.slice(0, 1200));
});

test("DATA-05 切换班级筛选", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/06-before-switch.png`, fullPage: true });
  const beforeUrl = page.url();
  const beforeBody = (await page.textContent("body")) ?? "";

  // try B-class chip / checkbox
  const cands = [
    page.locator('button:has-text("金融2024B班")').first(),
    page.locator('label:has-text("金融2024B班")').first(),
    page.locator('[role="checkbox"]:has-text("金融2024B班")').first(),
  ];
  let clicked = false;
  for (const c of cands) {
    if ((await c.count()) > 0) {
      await c.click().catch(() => {});
      clicked = true;
      break;
    }
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/07-after-switch.png`, fullPage: true });
  const afterUrl = page.url();
  const afterBody = (await page.textContent("body")) ?? "";
  console.log("DATA-05 clicked:", clicked, "urlChanged:", beforeUrl !== afterUrl, "bodyDiff:", Math.abs(beforeBody.length - afterBody.length));
});

test("DATA-06 学生 dashboard 自检", async ({ page }) => {
  await login(page, "student1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/08-student-dashboard.png`, fullPage: true });
});
