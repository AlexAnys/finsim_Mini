import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { handleServiceError } from "@/lib/api-utils";

// U1: Prisma P2003（外键约束失败）此前落到 default 分支 → 无意义的 500。
// 期望：映射为带 code 的中文兜底错误，便于前端提示而非裸 500。
describe("handleServiceError — Prisma P2003 外键约束", () => {
  it("maps P2003 to a Chinese error response (not a bare 500)", async () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint failed on the field: `ContentBlock_chapterId_fkey`",
      { code: "P2003", clientVersion: "x" },
    );

    const res = handleServiceError(err);
    expect(res.status).toBe(409);

    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FK_CONSTRAINT_FAILED");
    // 中文文案
    expect(body.error.message).toMatch(/[一-龥]/);
  });
});
