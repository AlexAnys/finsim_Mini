import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { clampTake } from "@/lib/pagination";
import type { SlotType, ContentBlockType } from "@prisma/client";

// ============================================
// 协作教师过滤器
// ============================================

export function teacherCourseFilter(teacherId: string): Prisma.CourseWhereInput {
  return { OR: [{ createdBy: teacherId }, { teachers: { some: { teacherId } } }] };
}

// 班级课程过滤器：命中主班（Course.classId）或通过 CourseClass 关联的次班
export function courseClassFilter(classId: string): Prisma.CourseWhereInput {
  return { OR: [{ classId }, { classes: { some: { classId } } }] };
}

// ============================================
// 批量访问检查
// ============================================

/**
 * 校验用户可访问所有给定课程。admin 直通，其他必须是 creator 或 CourseTeacher。
 * 任一课程不可访问即抛 FORBIDDEN；课程不存在抛 COURSE_NOT_FOUND。
 */
export async function assertCourseAccessBulk(
  courseIds: string[],
  userId: string,
  userRole: string
) {
  if (userRole === "admin") return;
  if (courseIds.length === 0) return;

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, createdBy: true },
  });
  if (courses.length !== courseIds.length) throw new Error("COURSE_NOT_FOUND");

  const nonOwned = courses.filter((c) => c.createdBy !== userId).map((c) => c.id);
  if (nonOwned.length === 0) return;

  const teacherRows = await prisma.courseTeacher.findMany({
    where: { courseId: { in: nonOwned }, teacherId: userId },
    select: { courseId: true },
  });
  const collaboratingIds = new Set(teacherRows.map((r) => r.courseId));
  for (const cid of nonOwned) {
    if (!collaboratingIds.has(cid)) throw new Error("FORBIDDEN");
  }
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

export async function getCoursesByTeacher(
  teacherId: string,
  options: { take?: number } = {},
) {
  return prisma.course.findMany({
    where: teacherCourseFilter(teacherId),
    include: {
      class: true,
      classes: { include: { class: true } },
      creator: { select: { id: true, name: true, email: true } },
      teachers: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(options.take, 100, 200),
  });
}

/**
 * 批量更新课程的学期开始日期。全成功或全失败（事务）。
 * 任一课程无权限或不存在 → 抛错，不做任何修改。
 */
export async function batchUpdateSemesterStart(
  courseIds: string[],
  startDate: Date,
  userId: string,
  userRole: string
) {
  if (courseIds.length === 0) throw new Error("EMPTY_COURSE_LIST");
  await assertCourseAccessBulk(courseIds, userId, userRole);
  return prisma.$transaction(
    courseIds.map((id) =>
      prisma.course.update({
        where: { id },
        data: { semesterStartDate: startDate },
      })
    )
  );
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
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (course.classId === classId) throw new Error("CANNOT_REMOVE_PRIMARY_CLASS");

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

export async function getCoursesByClass(
  classId: string,
  options: { take?: number } = {},
) {
  return prisma.course.findMany({
    where: {
      OR: [{ classId }, { classes: { some: { classId } } }],
    },
    include: { class: true, classes: { include: { class: true } } },
    orderBy: { createdAt: "desc" },
    take: clampTake(options.take, 100, 200),
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

export async function updateChapter(
  id: string,
  patch: { title?: string; order?: number }
) {
  const data: { title?: string; order?: number } = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.order !== undefined) data.order = patch.order;
  if (Object.keys(data).length === 0) throw new Error("EMPTY_PATCH");
  return prisma.chapter.update({ where: { id }, data });
}

export async function deleteChapter(id: string) {
  return prisma.chapter.delete({ where: { id } });
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

export async function updateSection(
  id: string,
  patch: { title?: string; order?: number }
) {
  const data: { title?: string; order?: number } = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.order !== undefined) data.order = patch.order;
  if (Object.keys(data).length === 0) throw new Error("EMPTY_PATCH");
  return prisma.section.update({ where: { id }, data });
}

export async function deleteSection(id: string) {
  return prisma.section.delete({ where: { id } });
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

export async function createContentBlock(data: {
  courseId: string;
  chapterId: string;
  sectionId: string;
  slot: SlotType;
  blockType: ContentBlockType;
  payload?: Prisma.InputJsonValue;
}) {
  // Validate that section actually belongs to the given chapter+course (prevents cross-course tampering)
  const section = await prisma.section.findUnique({
    where: { id: data.sectionId },
    select: { courseId: true, chapterId: true },
  });
  if (!section) throw new Error("SECTION_NOT_FOUND");
  if (section.courseId !== data.courseId || section.chapterId !== data.chapterId) {
    throw new Error("SECTION_PARENT_MISMATCH");
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
      blockType: data.blockType,
      order: (maxOrder._max.order ?? -1) + 1,
      data: data.payload ?? Prisma.JsonNull,
    },
  });
}

export async function updateContentBlock(
  id: string,
  patch: { payload?: Prisma.InputJsonValue; order?: number }
) {
  const data: Prisma.ContentBlockUpdateInput = {};
  if (patch.payload !== undefined) data.data = patch.payload;
  if (patch.order !== undefined) data.order = patch.order;
  if (Object.keys(data).length === 0) throw new Error("EMPTY_PATCH");
  return prisma.contentBlock.update({ where: { id }, data });
}

export async function deleteContentBlock(id: string) {
  return prisma.contentBlock.delete({ where: { id } });
}

/**
 * 批量调序：输入 [{id, order}]，在一个事务里更新所有 block 的 order。
 * 调用方需先 assert 每个 block 的 writable（endpoint 做）。
 * 若 id 集合跨多个 section，调序仍各自独立（schema 上 ContentBlock 无 @@unique 约束，允许）。
 */
export async function reorderContentBlocks(
  items: Array<{ id: string; order: number }>
) {
  if (items.length === 0) return [];
  return prisma.$transaction(
    items.map((it) =>
      prisma.contentBlock.update({
        where: { id: it.id },
        data: { order: it.order },
      })
    )
  );
}
