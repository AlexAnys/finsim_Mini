import type { FullConfig } from "@playwright/test";

// Runs before AND after the suite, while CI still holds the shared staging lock.
export default async function verifyCandidate(config: FullConfig) {
  const expectedSha = process.env.PLAYWRIGHT_EXPECTED_SHA;
  if (!expectedSha) {
    if (process.env.CI) throw new Error("PLAYWRIGHT_EXPECTED_SHA is required in CI");
    return; // Local WIP runs cannot be claimed as frozen deployment acceptance.
  }
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("An explicit Playwright baseURL is required");
  async function readIdentity() {
    const response = await fetch(new URL("/api/health/ready", baseURL), { signal: AbortSignal.timeout(10_000) });
    const body = await response.json();
    if (!response.ok || body.data?.ready !== true || body.data?.app !== "finsim" || body.data?.gitSha !== expectedSha) {
      throw new Error("QA environment is not the database-ready FinSim candidate at expected SHA");
    }
    return body.data;
  }
  const initial = await readIdentity();
  return async () => {
    const final = await readIdentity();
    if (final.configHash !== initial.configHash || final.databaseHash !== initial.databaseHash) {
      throw new Error("QA runtime/database routing changed during the test suite");
    }
  };
}
