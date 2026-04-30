import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().max(500).optional(),
});

export async function GET() {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: result.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        classId: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new Error("USER_NOT_FOUND");
    return success(user);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const user = await prisma.user.update({
      where: { id: result.session.user.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        classId: true,
        avatarUrl: true,
      },
    });
    return success(user);
  } catch (err) {
    return handleServiceError(err);
  }
}
