import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { batchDeleteSubmissions } from "@/lib/services/submission.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function DELETE(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = batchDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    await batchDeleteSubmissions(parsed.data.ids, result.session.user.id);
    return success({ deleted: parsed.data.ids.length });
  } catch (err) {
    return handleServiceError(err);
  }
}
