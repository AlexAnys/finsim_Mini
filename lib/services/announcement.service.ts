import { prisma } from "@/lib/db/prisma";
import { courseClassFilter } from "@/lib/services/course.service";

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
  status?: string;
}) {
  return prisma.announcement.findMany({
    where: {
      ...(filters.courseId && { courseId: filters.courseId }),
      ...(filters.classId && { course: courseClassFilter(filters.classId) }),
      ...(filters.status && { status: filters.status as "published" | "draft" | "archived" }),
    },
    include: {
      course: { select: { courseTitle: true } },
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
