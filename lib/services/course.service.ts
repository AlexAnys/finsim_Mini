import { prisma } from "@/lib/db/prisma";
import type { SlotType, ContentBlockType } from "@prisma/client";

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
  return prisma.course.create({
    data: {
      courseTitle: data.courseTitle,
      courseCode: data.courseCode,
      description: data.description,
      classId: data.classId,
      createdBy: data.createdBy,
    },
  });
}

export async function getCoursesByTeacher(teacherId: string) {
  return prisma.course.findMany({
    where: { createdBy: teacherId },
    include: { class: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCoursesByClass(classId: string) {
  return prisma.course.findMany({
    where: { classId },
    include: { class: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCourseWithStructure(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      class: true,
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
