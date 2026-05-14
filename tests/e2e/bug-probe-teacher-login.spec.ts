/**
 * Bug-probe teacher (molly) — login sanity + landing
 */
import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3000";
const OUT = path.resolve(process.cwd(), ".harness/screenshots/bug-probe-teacher");

function ensure() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
}

async function tryLogin(page: Page, email: string, pwd: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', pwd);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

test.setTimeout(60_000);

test("molly password sanity", async ({ page }) => {
  ensure();
  page.on("console", (m) => console.log(`[browser ${m.type()}]`, m.text().slice(0, 200)));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));

  const okA = await tryLogin(page, "molly@qq.com", "123456");
  console.log("login with 123456 →", okA, page.url());
  if (okA) {
    await page.screenshot({ path: path.join(OUT, "01-landing.png"), fullPage: true });
    return;
  }

  await page.goto(`${BASE}/login`);
  const okB = await tryLogin(page, "molly@qq.com", "password123");
  console.log("login with password123 →", okB, page.url());
  await page.screenshot({ path: path.join(OUT, "01-landing-pwd123.png"), fullPage: true });
});
