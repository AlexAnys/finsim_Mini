/**
 * Phase 3 M-5: molly release + 洞察
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";
const CLASS_ID_A = "deedd844-e302-4b20-903d-d9b1d0e12439";

const SUBMISSION_IDS = [
  "25cf3504-aedd-40a6-8bfa-47efdcab772a",
  "519b0655-b998-419e-9d16-0b5027f5733e",
  "6639c7d3-87d5-499c-b2af-901d44172476",
  "a5742498-10f7-441b-86ac-893fc40a9361",
  "c20bbde3-bd4a-409b-9fcf-418463a0afe2",
  "d0e3e574-1b73-4f0c-bbdd-63b913be6841",
];

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", ".harness", "screenshots", "phase3-m5");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function loginMolly(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', "molly@qq.com");
  await page.fill('input[type="password"], input[name="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30000 });
}

test("Phase 3 M-5: molly release + 洞察", async ({ page }) => {
  test.setTimeout(420_000);

  await loginMolly(page);
  console.log("✓ molly login OK");

  // === Step 1: release 全部 graded sub ===
  let releasedCount = 0;
  for (const id of SUBMISSION_IDS) {
    const r = await page.request.post(`/api/submissions/${id}/release`, { data: { released: true },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`  release ${id.slice(0, 8)}: ${r.status()}`);
    if (r.status() === 200 || r.status() === 201) releasedCount++;
    else {
      console.log("    body:", (await r.text()).slice(0, 200));
    }
  }
  console.log(`  → released: ${releasedCount}/${SUBMISSION_IDS.length}`);

  // === Step 2: 一周洞察 ===
  console.log("\n=== Step 2: 一周洞察 ===");
  const rWeekly = await page.request.get(`/api/lms/weekly-insight?force=true`);
  console.log(`  weekly-insight force: ${rWeekly.status()}`);
  if (rWeekly.status() === 200) {
    const w = await rWeekly.json();
    const data = w.data ?? w;
    console.log(`  modelUsed: ${data.modelUsed}`);
    console.log(`  durationMs: ${data.durationMs}`);
    console.log(`  inputTokens: ${data.inputTokens} outputTokens: ${data.outputTokens}`);
    console.log(`  submissionCount: ${data.payload?.submissionCount ?? data.submissionCount ?? "?"}`);
  } else if (rWeekly.status() === 429) {
    console.log("  429 — 60s cooldown, skip");
  } else {
    console.log("  body:", (await rWeekly.text()).slice(0, 300));
  }

  // dashboard + weekly modal 截图
  await page.goto("/teacher/dashboard");
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-dashboard.png"), fullPage: true });

  const weeklyBtn = page.locator('text=/一周洞察|生成一周洞察/').first();
  if ((await weeklyBtn.count()) > 0) {
    await weeklyBtn.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-weekly-modal.png"), fullPage: true });
  }

  // === Step 3: 数据洞察 v2 ===
  console.log("\n=== Step 3: 数据洞察 v2 ===");
  await page.goto(`/teacher/analytics-v2?courseId=${COURSE_ID}&classIds=${CLASS_ID_A}`);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(15000); // scope-insights AI 调用
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "03-analytics-v2.png"),
    fullPage: true,
  });
  const bodyText = await page.locator("body").innerText();
  console.log(`  analytics-v2 has 4-dim hint: ${["知识掌握", "技能", "群体", "教学策略"].some((k) => bodyText.includes(k))}`);

  // === Step 4: 教师 SB 管理页 ===
  console.log("\n=== Step 4: SB 管理页 ===");
  await page.goto("/teacher/study-buddy");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "04-teacher-sb.png"),
    fullPage: true,
  });

  // === Step 5: AI 用量 ===
  console.log("\n=== Step 5: AI 用量 ===");
  await page.goto("/teacher/ai-usage");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "05-ai-usage.png"),
    fullPage: true,
  });
  const aiUsageBody = await page.locator("body").innerText();
  console.log(`  ai-usage has 'tokens|成本': ${aiUsageBody.includes("token") || aiUsageBody.includes("成本") || aiUsageBody.includes("Token")}`);

  console.log("\n=== M-5 done ===");
  console.log(`released: ${releasedCount}/${SUBMISSION_IDS.length}`);
});
