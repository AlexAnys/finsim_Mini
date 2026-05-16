import { test, expect } from "@playwright/test";
import { loginAs } from "./_setup";

/**
 * Smoke 05: admin 触发 weekly-insight cron → assert 接口返回 success.
 *
 * 不验证 AI 内容生成 (依赖 provider), 只验证 cron 入口 + 权限 + 流程不挂.
 * admin 角色或 x-cron-token 都可以触发, 用 admin 路径 (CI 不存 CRON_TOKEN).
 */
test("smoke-05 admin 触发 weekly-insight cron", async ({ browser }) => {
  const adminPage = await loginAs(browser, "admin");
  const r = adminPage.request;

  // 默认 5 min timeout, weekly-insight 真生成可能慢 (AI 调用)
  const cronRes = await r.get(`/api/cron/weekly-insight`, { timeout: 4 * 60_000 });
  expect(cronRes.status()).toBe(200);
  const json = await cronRes.json();
  expect(json.success).toBe(true);
  // results 是数组 (空也 OK — 没 teacher 就空数组)
  expect(Array.isArray(json.data?.results)).toBe(true);
});
