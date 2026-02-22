import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createSection } from "@/lib/services/course.service";
import { created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createSectionSchema = z.object({
  courseId: z.string().uuid(),
  chapterId: z.string().uuid(),
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createSectionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const section = await createSection({
      ...parsed.data,
      createdBy: result.session.user.id,
    });
    return created(section);
  } catch (err) {
    return handleServiceError(err);
  }
}
