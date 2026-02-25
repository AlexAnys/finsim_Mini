import { prisma } from "@/lib/db/prisma";
import type { SlotType, ContentBlockType, Prisma } from "@prisma/client";

// ============================================
// 协作教师过滤器
// ============================================

export function teacherCourseFilter(teacherId: string): Prisma.CourseWhereInput {
  return { OR: [{ createdBy: teacherId }, { teachers: { some: { teacherId } } }] };
}

// ============================================
// 课程 CRUD
// ============================================

export async function createCourse(data: {
  courseTitle: string;
  courseCode?: string;
  description?: string;
  classId: string;
  createdBy: string;
}) {
  const course = await prisma.course.create({
    data: {
      courseTitle: data.courseTitle,
      courseCode: data.courseCode,
      description: data.description,
      classId: data.classId,
      createdBy: data.createdBy,
    },
  });
  // Auto-create CourseClass record for the primary class
  await prisma.courseClass.create({
    data: { courseId: course.id, classId: data.classId },
  });
  return course;
}

export async function getCoursesByTeacher(teacherId: string) {
  return prisma.course.findMany({
    where: teacherCourseFilter(teacherId),
    include: { class: true, classes: { include: { class: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================
// CourseTeacher CRUD
// ============================================

export async function addCourseTeacher(courseId: string, teacherEmail: string) {
  const teacher = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!teacher) throw new Error("USER_NOT_FOUND");
  if (teacher.role !== "teacher" && teacher.role !== "admin") throw new Error("NOT_A_TEACHER");

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (course.createdBy === teacher.id) throw new Error("ALREADY_OWNER");

  return prisma.courseTeacher.create({
    data: { courseId, teacherId: teacher.id },
    include: { teacher: { select: { id: true, name: true, email: true } } },
  });
}

export async function removeCourseTeacher(courseId: string, teacherId: string) {
  return prisma.courseTeacher.delete({
    where: { courseId_teacherId: { courseId, teacherId } },
  });
}

export async function getCourseTeachers(courseId: string) {
  return prisma.courseTeacher.findMany({
    where: { courseId },
    include: { teacher: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// ============================================
// CourseClass CRUD
// ============================================

export async function addCourseClass(courseId: string, classId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("CLASS_NOT_FOUND");

  return prisma.courseClass.create({
    data: { courseId, classId },
    include: { class: true },
  });
}

export async function removeCourseClass(courseId: string, classId: string) {
  return prisma.courseClass.delete({
    where: { courseId_classId: { courseId, classId } },
  });
}

export async function getCourseClasses(courseId: string) {
  return prisma.courseClass.findMany({
    where: { courseId },
    include: { class: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCoursesByClass(classId: string) {
  return prisma.course.findMany({
    where: {
      OR: [{ classId }, { classes: { some: { classId } } }],
    },
    include: { class: true, classes: { include: { class: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCourseWithStructure(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      class: true,
      classes: { include: { class: true } },
      chapters: {
        orderBy: { order: "asc" },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              contentBlocks: {
                orderBy: [{ slot: "asc" }, { order: "asc" }],
              },
              taskInstances: {
                where: { status: { in: ["published", "draft"] } },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });
}

// ============================================
// 章节 CRUD
// ============================================

export async function createChapter(data: {
  courseId: string;
  title: string;
  order: number;
  createdBy: string;
}) {
  return prisma.chapter.create({ data });
}

export async function getChaptersByCourse(courseId: string) {
  return prisma.chapter.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
  });
}

// ============================================
// 小节 CRUD
// ============================================

export async function createSection(data: {
  courseId: string;
  chapterId: string;
  title: string;
  order: number;
  createdBy: string;
}) {
  return prisma.section.create({ data });
}

// ============================================
// 内容块 CRUD
// ============================================

export async function upsertMarkdownBlock(data: {
  courseId: string;
  chapterId: string;
  sectionId: string;
  slot: SlotType;
  content: string;
}) {
  const blockType: ContentBlockType = "markdown";
  const existing = await prisma.contentBlock.findFirst({
    where: {
      sectionId: data.sectionId,
      slot: data.slot,
      blockType,
    },
  });

  if (existing) {
    return prisma.contentBlock.update({
      where: { id: existing.id },
      data: { data: { content: data.content } },
    });
  }

  const maxOrder = await prisma.contentBlock.aggregate({
    where: { sectionId: data.sectionId, slot: data.slot },
    _max: { order: true },
  });

  return prisma.contentBlock.create({
    data: {
      courseId: data.courseId,
      chapterId: data.chapterId,
      sectionId: data.sectionId,
      slot: data.slot,
      blockType,
      order: (maxOrder._max.order ?? -1) + 1,
      data: { content: data.content },
    },
  });
}
