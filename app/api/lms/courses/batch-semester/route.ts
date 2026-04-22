import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { batchUpdateSemesterStart } from "@/lib/services/course.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const patchSchema = z.object({
  courseIds: z.array(z.string().uuid()).min(1),
  semesterStartDate: z.string().datetime(),
});

export async function PATCH(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const updated = await batchUpdateSemesterStart(
      parsed.data.courseIds,
      new Date(parsed.data.semesterStartDate),
      result.session.user.id,
      result.session.user.role
    );
    return success({ updatedCount: updated.length });
  } catch (err) {
    return handleServiceError(err);
  }
}
