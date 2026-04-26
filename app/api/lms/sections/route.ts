import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { createSection } from "@/lib/services/course.service";
import { prisma } from "@/lib/db/prisma";
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

    const { user } = result.session;
    // PR-FIX-1 A5: 防教师向他人课程插入小节 + 防 chapter/course 跨课错位
    await assertCourseAccess(parsed.data.courseId, user.id, user.role);
    const ch = await prisma.chapter.findUnique({
      where: { id: parsed.data.chapterId },
      select: { courseId: true },
    });
    if (!ch) throw new Error("CHAPTER_NOT_FOUND");
    if (ch.courseId !== parsed.data.courseId) {
      throw new Error("CHAPTER_COURSE_MISMATCH");
    }

    const section = await createSection({
      ...parsed.data,
      createdBy: user.id,
    });
    return created(section);
  } catch (err) {
    return handleServiceError(err);
  }
}
