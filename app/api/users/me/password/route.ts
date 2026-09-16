import { NextRequest } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { handleServiceError, success, validationError, error } from "@/lib/api-utils";

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export async function PATCH(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const parsed = passwordSchema.safeParse(await request.json());
    if (!parsed.success) return validationError("请求参数错误", parsed.error.flatten());

    const user = await prisma.user.findUnique({
      where: { id: result.session.user.id },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const ok = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return error("INVALID_PASSWORD", "当前密码不正确", 400);

    const updated = await prisma.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash },
      data: { passwordHash: await hash(parsed.data.newPassword, 12) },
    });
    if (updated.count !== 1) {
      return error("PASSWORD_CHANGED", "密码已在其他会话中更新，请使用最新密码重新登录", 409);
    }

    return success({ updated: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
