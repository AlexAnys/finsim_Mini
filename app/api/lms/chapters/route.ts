import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createChapter } from "@/lib/services/course.service";
import { created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createChapterSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createChapterSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const chapter = await createChapter({
      ...parsed.data,
      createdBy: result.session.user.id,
    });
    return created(chapter);
  } catch (err) {
    return handleServiceError(err);
  }
}
