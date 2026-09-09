import { test, expect } from "@playwright/test";

test("cold login waits for the first real session response, then signs in exactly once", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: process.env.PILOT_BASE_URL || "http://127.0.0.1:3107" });
  const page = await context.newPage();
  let unblock: () => void = () => {};
  let observed: () => void = () => {};
  const held = new Promise<void>(resolve => { unblock = resolve; });
  const firstSession = new Promise<void>(resolve => { observed = resolve; });
  let sessionRequests = 0;
  let credentialRequests = 0;
  await page.route("**/api/auth/session", async route => {
    sessionRequests++;
    if (sessionRequests === 1) { observed(); await held; }
    await route.continue();
  });
  page.on("request", request => {
    if (request.method() === "POST" && request.url().includes("/api/auth/callback/credentials")) credentialRequests++;
  });
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await firstSession;
    // This is a deterministic network gate, not a timer or a login retry.
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "登录", exact: true })).toHaveCount(0);
    expect(sessionRequests).toBe(1);
    expect(credentialRequests).toBe(0);
    unblock();
    await page.locator('input[type="email"]').fill("student1@finsim.edu.cn");
    await page.locator('input[type="password"]').fill("password123");
    const callback = page.waitForResponse(response => response.url().includes("/api/auth/callback/credentials"));
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const response = await callback;
    expect(response.ok()).toBe(true);
    expect(JSON.stringify(await response.json())).not.toContain("MissingCSRF");
    await page.waitForURL(url => url.pathname === "/dashboard");
    expect(credentialRequests).toBe(1);
  } finally {
    unblock(); await context.close();
  }
});
