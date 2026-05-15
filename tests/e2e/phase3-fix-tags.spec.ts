/**
 * Phase 3 fix: 重新 trigger quiz tagging，看为啥 result.tagged=10 但 DB 都是空 {}
 */
import { test, expect, type Page } from "@playwright/test";

const QUIZ_TASK_ID = "9cd29095-7131-4a93-8395-69283666859d";

async function loginMolly(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', "molly@qq.com");
  await page.fill('input[type="password"], input[name="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 });
}

test("phase3-fix: re-trigger quiz tag", async ({ page }) => {
  test.setTimeout(120_000);
  await loginMolly(page);

  const r = await page.request.post(`/api/lms/tasks/${QUIZ_TASK_ID}/tag-questions`, {
    headers: { "Content-Type": "application/json" },
  });
  console.log(`POST tag-questions: ${r.status()}`);
  const body = await r.text();
  console.log(`body: ${body}`);
  expect([200, 201]).toContain(r.status());
});
