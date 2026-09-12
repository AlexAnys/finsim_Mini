import { test, expect } from "@playwright/test";
import { loginAs } from "./_setup";

/**
 * Smoke 05: teacher/student 不能触发全教师周洞察。
 *
 * 共享 staging 只检查权限，避免生成全教师数据和额外 AI 花费。
 * 生成/失败/无数据计数由本地真实 service → cron 受控集成测试验证。
 */
test("smoke-05 teacher/student 无权触发 weekly-insight cron", async ({ browser }) => {
  for (const account of ["teacher1", "student1"] as const) {
    const page = await loginAs(browser, account);
    try {
      const me = await page.request.get("/api/users/me");
      expect(me.status()).toBe(200);
      expect((await me.json()).data?.role).toBe(account === "teacher1" ? "teacher" : "student");
      for (const method of ["get", "post"] as const) {
        const response = await page.request[method]("/api/cron/weekly-insight", { headers: { "x-cron-token": "" } });
        expect(response.status()).toBe(401);
        expect(await response.json()).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
      }
    } finally {
      await page.context().close();
    }
  }
});
