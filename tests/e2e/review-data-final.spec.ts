import { test } from "@playwright/test";
import path from "path";
const BASE = "http://localhost:3000";
const SHOTS = path.resolve(__dirname, "../../.harness/screenshots/review-2026-05-13/data");
async function login(page: any, email: string, pw: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await Promise.all([
    page.waitForURL((u: URL) => !/\/login/.test(u.pathname), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
}
test.setTimeout(120_000);
test("DATA-04b inst with subs", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/instances/57c9940b-4d55-4760-9697-2d88d1c40933/insights`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/09-inst-with-subs.png`, fullPage: true });
  const t = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");
  console.log("INST text:", t.slice(0, 1500));
});
