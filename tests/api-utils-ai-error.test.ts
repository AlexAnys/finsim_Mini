import { describe, expect, it } from "vitest";
import { handleServiceError } from "@/lib/api-utils";

describe("handleServiceError AI provider errors", () => {
  it("maps provider insufficient balance responses to an actionable error", async () => {
    const err = new Error("Insufficient account balance") as Error & {
      statusCode?: number;
      data?: {
        error?: {
          code?: string;
          type?: string;
          message?: string;
        };
      };
    };
    err.name = "AI_APICallError";
    err.statusCode = 402;
    err.data = {
      error: {
        code: "402",
        type: "insufficient_balance",
        message: "Insufficient account balance",
      },
    };

    const response = handleServiceError(err);
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.error.code).toBe("AI_PROVIDER_QUOTA_EXCEEDED");
    expect(body.error.message).toContain("AI 服务额度不足");
  });
});
