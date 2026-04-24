import { prisma } from "@/lib/db/prisma";
import { courseClassFilter, teacherCourseFilter } from "@/lib/services/course.service";
import type { Prisma } from "@prisma/client";

export async function createAnnouncement(data: {
  courseId: string;
  title: string;
  body: string;
  status?: "published" | "draft";
  createdBy: string;
}) {
  // 验证教师拥有该课程（含协作教师）
  const course = await prisma.course.findUnique({ where: { id: data.courseId } });
  if (!course) throw new Error("FORBIDDEN");
  if (course.createdBy !== data.createdBy) {
    const collab = await prisma.courseTeacher.findUnique({
      where: { courseId_teacherId: { courseId: data.courseId, teacherId: data.createdBy } },
    });
    if (!collab) throw new Error("FORBIDDEN");
  }

  return prisma.announcement.create({
    data: {
      courseId: data.courseId,
      title: data.title,
      body: data.body,
      status: data.status ?? "draft",
      createdBy: data.createdBy,
    },
  });
}

export async function getAnnouncements(filters: {
  courseId?: string;
  classId?: string;
  teacherId?: string;
  status?: string;
}) {
  const where: Prisma.AnnouncementWhereInput = {};
  if (filters.courseId) where.courseId = filters.courseId;
  if (filters.status) where.status = filters.status as "published" | "draft" | "archived";

  // classId / teacherId 同样落到 course 子条件下，显式合并避免 spread 同名 key 覆盖。
  const courseConditions: Prisma.CourseWhereInput[] = [];
  if (filters.classId) courseConditions.push(courseClassFilter(filters.classId));
  if (filters.teacherId) courseConditions.push(teacherCourseFilter(filters.teacherId));
  if (courseConditions.length === 1) {
    where.course = courseConditions[0];
  } else if (courseConditions.length > 1) {
    where.course = { AND: courseConditions };
  }

  return prisma.announcement.findMany({
    where,
    include: {
      course: { select: { courseTitle: true } },
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
