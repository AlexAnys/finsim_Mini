import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";

async function loginTeacher(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "teacher1@finsim.edu.cn");
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(120_000);

test("M1-data: 数据现状 — graded vs released", async ({ page }) => {
  await loginTeacher(page);

  // dashboard summary 全数据
  const dashRes = await page.request.get(`${BASE}/api/lms/dashboard/summary`);
  const dash = (await dashRes.json()).data;

  console.log("\n=== recentSubmissions 全量分析 ===");
  console.log("总数:", dash.recentSubmissions.length);
  const byStatus = new Map<string, number>();
  const byReleased = new Map<string, number>();
  let gradedAtMin: string | null = null;
  let gradedAtMax: string | null = null;
  let releasedNotNull = 0;
  for (const s of dash.recentSubmissions) {
    byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
    const r = s.releasedAt ? "yes" : "no";
    byReleased.set(r, (byReleased.get(r) ?? 0) + 1);
    if (s.releasedAt) releasedNotNull++;
    if (s.gradedAt) {
      if (!gradedAtMin || s.gradedAt < gradedAtMin) gradedAtMin = s.gradedAt;
      if (!gradedAtMax || s.gradedAt > gradedAtMax) gradedAtMax = s.gradedAt;
    }
  }
  console.log("by status:", Object.fromEntries(byStatus));
  console.log("by releasedAt:", Object.fromEntries(byReleased));
  console.log("releasedAt not-null 数量:", releasedNotNull);
  console.log("gradedAt range:", gradedAtMin, "→", gradedAtMax);
  console.log("Now:", new Date().toISOString());

  // 单条样例
  console.log("\n=== Sample recentSubmissions[0] ===");
  console.log(JSON.stringify(dash.recentSubmissions[0], null, 2));

  // stats 对比
  console.log("\n=== stats ===");
  console.log(JSON.stringify(dash.stats, null, 2));
});

test("M1-data-2: weekly-insight 触发 5 次 — 看是否扣 token / 节流", async ({ page }) => {
  await loginTeacher(page);

  console.log("\n=== 第 1 次 force=true（应触发 AI）===");
  const t1 = Date.now();
  const r1 = await page.request.get(`${BASE}/api/lms/weekly-insight?force=true`);
  const ms1 = Date.now() - t1;
  const j1 = await r1.json();
  console.log("  耗时:", ms1, "ms, cached:", j1.data?.cached, "subCount:", j1.data?.submissionCount);

  console.log("\n=== 第 2 次（无 force，应 cached）===");
  const t2 = Date.now();
  const r2 = await page.request.get(`${BASE}/api/lms/weekly-insight`);
  const ms2 = Date.now() - t2;
  const j2 = await r2.json();
  console.log("  耗时:", ms2, "ms, cached:", j2.data?.cached);

  console.log("\n=== 第 3 次 force=true（短间隔重复调，应每次扣 token）===");
  const t3 = Date.now();
  const r3 = await page.request.get(`${BASE}/api/lms/weekly-insight?force=true`);
  const ms3 = Date.now() - t3;
  const j3 = await r3.json();
  console.log("  耗时:", ms3, "ms, cached:", j3.data?.cached);

  console.log("\n=== 第 4 次 force=true（再次）===");
  const t4 = Date.now();
  const r4 = await page.request.get(`${BASE}/api/lms/weekly-insight?force=true`);
  const ms4 = Date.now() - t4;
  const j4 = await r4.json();
  console.log("  耗时:", ms4, "ms, cached:", j4.data?.cached);

  console.log("\n判断: 三次 force=true 各自耗时", ms1, ms3, ms4, "ms - 若都 >>5s 说明都真调了 AI");
});

test("M1-data-3: AI 调用留痕 — 检查 AsyncJob / AIUsage / FeatureUsageEvent 表", async ({ page }) => {
  await loginTeacher(page);

  // 看有无 admin/AI usage 接口
  const usageRes = await page.request.get(`${BASE}/api/admin/usage-events?type=weekly-insight`);
  console.log("usage events status:", usageRes.status());
  if (usageRes.ok()) {
    const j = await usageRes.json();
    console.log("  json (first 600):", JSON.stringify(j).slice(0, 600));
  }
  // 看 my-ai-events
  const myRes = await page.request.get(`${BASE}/api/lms/my-ai-events`);
  console.log("my-ai-events status:", myRes.status());
  if (myRes.ok()) {
    const j = await myRes.json();
    console.log("  json (first 600):", JSON.stringify(j).slice(0, 600));
  }
});
