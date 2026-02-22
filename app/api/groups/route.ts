import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createGroup, getGroupsByTeacher } from "@/lib/services/group.service";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createGroupSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.enum(["manual", "auto_score_bucket"]),
  meta: z.record(z.string(), z.unknown()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const group = await createGroup({
      teacherId: result.session.user.id,
      ...parsed.data,
    });
    return created(group);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET() {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const groups = await getGroupsByTeacher(result.session.user.id);
    return success(groups);
  } catch (err) {
    return handleServiceError(err);
  }
}
