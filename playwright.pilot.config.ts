import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PILOT_BASE_URL || "http://127.0.0.1:3107";
const url = new URL(baseURL);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "3107") {
  throw new Error("Pilot tests are restricted to the isolated local app on port 3107");
}
export default defineConfig({
  testDir: "./tests/e2e/pilot",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/e2e/infra/version-check.ts",
  outputDir: "test-results/pilot",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/pilot", open: "never" }]],
  use: { baseURL, ...devices["Desktop Chrome"], screenshot: "only-on-failure", trace: "retain-on-failure", video: "retain-on-failure" },
});
