import { prisma } from "@/lib/db/prisma";

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
}) {
  return prisma.scheduleSlot.findMany({
    where: {
      ...(filters.courseId && { courseId: filters.courseId }),
      ...(filters.classId && { course: { classId: filters.classId } }),
      ...(filters.teacherId && { course: { createdBy: filters.teacherId } }),
    },
    include: {
      course: {
        select: {
          courseTitle: true,
          classId: true,
          class: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { slotIndex: "asc" }],
  });
}
