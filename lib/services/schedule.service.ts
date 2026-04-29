import { prisma } from "@/lib/db/prisma";
import { teacherCourseFilter, courseClassFilter } from "@/lib/services/course.service";
import { clampTake } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export async function createScheduleSlot(data: {
  courseId: string;
  dayOfWeek: number;
  slotIndex: number;
  startWeek: number;
  endWeek: number;
  timeLabel: string;
  classroom?: string;
  weekType?: string;
  createdBy: string;
}) {
  return prisma.scheduleSlot.create({ data });
}

export async function getScheduleSlots(filters: {
  courseId?: string;
  classId?: string;
  teacherId?: string;
  take?: number;
}) {
  const where: Prisma.ScheduleSlotWhereInput = {};
  if (filters.courseId) where.courseId = filters.courseId;

  // classId 和 teacherId 写到同一个 course 子条件下（都过滤 course），
  // 显式合并以避免 key 互相覆盖（原实现用 spread 同名 key，后一个会吃掉前一个）。
  const courseConditions: Prisma.CourseWhereInput[] = [];
  if (filters.classId) courseConditions.push(courseClassFilter(filters.classId));
  if (filters.teacherId) courseConditions.push(teacherCourseFilter(filters.teacherId));
  if (courseConditions.length === 1) {
    where.course = courseConditions[0];
  } else if (courseConditions.length > 1) {
    where.course = { AND: courseConditions };
  }

  return prisma.scheduleSlot.findMany({
    where,
    include: {
      course: {
        select: {
          courseTitle: true,
          classId: true,
          semesterStartDate: true,
          class: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { slotIndex: "asc" }],
    take: clampTake(filters.take, 200, 200),
  });
}
