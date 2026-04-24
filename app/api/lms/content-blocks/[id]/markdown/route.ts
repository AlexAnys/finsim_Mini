import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { upsertMarkdownBlock } from "@/lib/services/course.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const markdownSchema = z.object({
  courseId: z.string().uuid(),
  chapterId: z.string().uuid(),
  sectionId: z.string().uuid(),
  slot: z.enum(["pre", "in", "post"]),
  content: z.string(),
});

export async function PUT(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = markdownSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    await assertCourseAccess(parsed.data.courseId, user.id, user.role);

    const block = await upsertMarkdownBlock(parsed.data);
    return success(block);
  } catch (err) {
    return handleServiceError(err);
  }
}
