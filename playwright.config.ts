import { defineConfig, devices } from "@playwright/test";

/**
 * 权威 Playwright config (Playwright CLI 默认拾取).
 *
 * 用法:
 *   本地 (假设 dev server 已在 3000):
 *     npx playwright test
 *   CI (staging):
 *     PLAYWRIGHT_BASE_URL=https://staging.finsim.anlanai.cn npx playwright test
 *
 * 3 个旧 *.config.ts (review / qa-fix-3 / codex-r4 / iw) 保留作历史 e2e debug, 不被 default 拾取.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e/smoke",
  timeout: 5 * 60 * 1000, // 5 min/test (AI 真调外部 provider 慢)
  fullyParallel: false,
  workers: 1, // staging 共享栈, 严格串行
  retries: process.env.CI ? 2 : 0, // CI flaky 容忍 2 retry
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: process.env.CI ? "retain-on-failure" : "off",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
