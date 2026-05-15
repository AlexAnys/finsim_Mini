import { prisma } from "@/lib/db/prisma";

/**
 * Unit 5c: 推断当前用户对课程的角色，用于 audit log metadata 区分 owner / collaborator / admin。
 *
 * 返回 'owner' 当 course.createdBy === userId
 * 返回 'admin' 当 role === 'admin'
 * 返回 'collaborator' 当 CourseTeacher 有记录
 * 返回 'none' 其他（一般不会到此，因为 assertCourseAccess 会先 403）
 */
export type CourseActorRole = "owner" | "admin" | "collaborator" | "none";

export async function getCourseActorRole(
  courseId: string,
  userId: string,
  userRole: string,
): Promise<CourseActorRole> {
  if (userRole === "admin") return "admin";
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { createdBy: true },
  });
  if (!course) return "none";
  if (course.createdBy === userId) return "owner";
  const collab = await prisma.courseTeacher.findUnique({
    where: { courseId_teacherId: { courseId, teacherId: userId } },
  });
  if (collab) return "collaborator";
  return "none";
}
