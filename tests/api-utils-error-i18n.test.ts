import { describe, expect, it } from "vitest";
import { handleServiceError } from "@/lib/api-utils";

// Fix 9: 8 个错误码 service 层抛出但 handleServiceError 没映射，前端拿到英文
// "Internal Server Error"。本测试一次性覆盖 8 个新 case + 一个 default fallback
// 防回归。
//
// 注：404 类错误统一映射到 code="NOT_FOUND"（参考 notFound() helper 现有约定，
// 跟 COURSE_NOT_FOUND / TASK_NOT_FOUND / SUBMISSION_NOT_FOUND 等保持一致）。
// 其余非 404 错误码直接保留为原 code。
describe("handleServiceError — newly mapped service error codes (Fix 9)", () => {
  const cases: Array<{
    code: string;
    expectStatus: number;
    expectResponseCode: string;
    expectMessageContains: string;
  }> = [
    {
      code: "MISSING_SIMULATION_DATA",
      expectStatus: 400,
      expectResponseCode: "MISSING_SIMULATION_DATA",
      expectMessageContains: "模拟对话数据",
    },
    {
      code: "MISSING_QUIZ_DATA",
      expectStatus: 400,
      expectResponseCode: "MISSING_QUIZ_DATA",
      expectMessageContains: "测验作答数据",
    },
    {
      code: "MISSING_SUBJECTIVE_DATA",
      expectStatus: 400,
      expectResponseCode: "MISSING_SUBJECTIVE_DATA",
      expectMessageContains: "主观题作答数据",
    },
    {
      code: "TASK_BUILD_DRAFT_NOT_FOUND",
      expectStatus: 404,
      expectResponseCode: "NOT_FOUND",
      expectMessageContains: "任务草稿不存在",
    },
    {
      code: "TASK_BUILD_DRAFT_SCOPE_MISMATCH",
      expectStatus: 400,
      expectResponseCode: "TASK_BUILD_DRAFT_SCOPE_MISMATCH",
      expectMessageContains: "任务草稿不属于当前课程",
    },
    {
      code: "NO_POSTS_TO_SUMMARIZE",
      expectStatus: 400,
      expectResponseCode: "NO_POSTS_TO_SUMMARIZE",
      expectMessageContains: "暂无可总结的讨论帖",
    },
    {
      code: "WORK_ASSISTANT_EMPTY_INPUT",
      expectStatus: 400,
      expectResponseCode: "WORK_ASSISTANT_EMPTY_INPUT",
      expectMessageContains: "请输入需要 AI 协助的内容",
    },
    {
      code: "AI_PROVIDER_NOT_FOUND",
      expectStatus: 404,
      expectResponseCode: "AI_PROVIDER_NOT_FOUND",
      expectMessageContains: "AI 服务商未配置",
    },
  ];

  it.each(cases)(
    "maps $code to a $expectStatus Chinese response",
    async ({ code, expectStatus, expectResponseCode, expectMessageContains }) => {
      const response = handleServiceError(new Error(code));
      const body = await response.json();

      expect(response.status).toBe(expectStatus);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(expectResponseCode);
      expect(body.error.message).toContain(expectMessageContains);
      // 保证消息含中文字符（非 ASCII），不是英文 fallback
      expect(/[一-鿿]/.test(body.error.message)).toBe(true);
    },
  );

  it("falls back to 500 INTERNAL_ERROR for unknown service codes", async () => {
    const response = handleServiceError(new Error("THIS_CODE_DOES_NOT_EXIST"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("does not regress existing mapped codes — FORBIDDEN → 403", async () => {
    const response = handleServiceError(new Error("FORBIDDEN"));
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("does not regress existing mapped codes — COURSE_NOT_FOUND → 404", async () => {
    const response = handleServiceError(new Error("COURSE_NOT_FOUND"));
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("课程不存在");
  });
});
