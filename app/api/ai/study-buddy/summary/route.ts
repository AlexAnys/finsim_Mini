import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { generateSummary } from "@/lib/services/study-buddy.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const summarySchema = z.object({
  taskId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = summarySchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    const summary = await generateSummary(parsed.data.taskId, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    return success(summary);
  } catch (err) {
    return handleServiceError(err);
  }
}
