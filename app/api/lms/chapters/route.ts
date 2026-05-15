import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { getCourseActorRole } from "@/lib/auth/actor-role";
import { createChapter } from "@/lib/services/course.service";
import { logAuditForced } from "@/lib/services/audit.service";
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

    const { user } = result.session;
    // PR-FIX-1 A4: 防教师向他人课程插入章节
    await assertCourseAccess(parsed.data.courseId, user.id, user.role);
    // Unit 5c: actor role for audit
    const actorRole = await getCourseActorRole(parsed.data.courseId, user.id, user.role);

    const chapter = await createChapter({
      ...parsed.data,
      createdBy: user.id,
    });
    await logAuditForced({
      action: "chapter.create",
      actorId: user.id,
      targetId: chapter.id,
      targetType: "chapter",
      metadata: { courseId: parsed.data.courseId, title: parsed.data.title, actorRole },
    });
    return created(chapter);
  } catch (err) {
    return handleServiceError(err);
  }
}
