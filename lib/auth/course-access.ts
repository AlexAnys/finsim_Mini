import { prisma } from "@/lib/db/prisma";

/**
 * 断言用户可访问该课程。admin 直通；其他必须是 course.createdBy 或 CourseTeacher。
 * 抛 COURSE_NOT_FOUND / FORBIDDEN（由 handleServiceError 映射到 HTTP）。
 *
 * 独立文件（不随 guards.ts 走 NextAuth 路径），便于在不启 NextAuth 的单测里直接 import。
 */
export async function assertCourseAccess(
  courseId: string,
  userId: string,
  userRole: string
): Promise<void> {
  if (userRole === "admin") return;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (course.createdBy === userId) return;
  const ct = await prisma.courseTeacher.findUnique({
    where: { courseId_teacherId: { courseId, teacherId: userId } },
  });
  if (!ct) throw new Error("FORBIDDEN");
}
