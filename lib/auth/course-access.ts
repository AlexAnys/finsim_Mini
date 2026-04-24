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

/**
 * 断言学生可查看该课程：必须是主班（Course.classId）或通过 CourseClass 关联的次班。
 * 抛 COURSE_NOT_FOUND / FORBIDDEN（由 handleServiceError 映射到 HTTP）。
 *
 * classId 为空字符串时直接 FORBIDDEN（未分班学生不该访问任何课程详情）。
 */
export async function assertCourseAccessForStudent(
  courseId: string,
  classId: string
): Promise<void> {
  if (!classId) throw new Error("FORBIDDEN");
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      classId: true,
      classes: { select: { classId: true } },
    },
  });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (course.classId === classId) return;
  const match = course.classes.some((cc) => cc.classId === classId);
  if (!match) throw new Error("FORBIDDEN");
}

/**
 * 角色无关的课程访问断言：根据用户角色分派到对应的断言函数。
 * teacher / admin 走 owner+collab 路径；student 走主班+CourseClass 路径。
 */
export async function assertCourseReadable(
  courseId: string,
  user: { id: string; role: string; classId?: string | null }
): Promise<void> {
  if (user.role === "student") {
    await assertCourseAccessForStudent(courseId, user.classId ?? "");
    return;
  }
  await assertCourseAccess(courseId, user.id, user.role);
}
