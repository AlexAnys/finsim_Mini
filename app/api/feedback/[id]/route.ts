import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { updateFeedbackStatus } from "@/lib/services/feedback.service";

const patchSchema = z.object({
  status: z.enum(["new", "handled"]),
});

/**
 * PATCH /api/feedback/[id] —— 管理员标记反馈处理状态（new / handled）。
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("状态参数不合法", parsed.error.flatten());
    }

    const feedback = await updateFeedbackStatus(id, parsed.data.status);
    return success({ id: feedback.id, status: feedback.status });
  } catch (err) {
    return handleServiceError(err);
  }
}
