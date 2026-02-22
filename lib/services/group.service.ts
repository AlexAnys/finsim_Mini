import { prisma } from "@/lib/db/prisma";

export async function createGroup(data: {
  teacherId: string;
  classId: string;
  name: string;
  type: "manual" | "auto_score_bucket";
  meta?: Record<string, unknown>;
  studentIds?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.studentGroup.create({
      data: {
        teacherId: data.teacherId,
        classId: data.classId,
        name: data.name,
        type: data.type,
        meta: (data.meta ?? undefined) as import("@prisma/client").Prisma.InputJsonValue | undefined,
      },
    });

    if (data.studentIds?.length) {
      await tx.studentGroupMember.createMany({
        data: data.studentIds.map((studentId) => ({
          groupId: group.id,
          studentId,
        })),
      });
    }

    return group;
  });
}

export async function getGroupsByTeacher(teacherId: string) {
  return prisma.studentGroup.findMany({
    where: { teacherId },
    include: {
      class: { select: { id: true, name: true } },
      members: {
        include: {
          student: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateGroup(
  groupId: string,
  teacherId: string,
  data: {
    name?: string;
    addStudentIds?: string[];
    removeStudentIds?: string[];
  }
) {
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
  if (!group || group.teacherId !== teacherId) {
    throw new Error("FORBIDDEN");
  }

  return prisma.$transaction(async (tx) => {
    if (data.name) {
      await tx.studentGroup.update({
        where: { id: groupId },
        data: { name: data.name },
      });
    }

    if (data.addStudentIds?.length) {
      await tx.studentGroupMember.createMany({
        data: data.addStudentIds.map((studentId) => ({
          groupId,
          studentId,
        })),
        skipDuplicates: true,
      });
    }

    if (data.removeStudentIds?.length) {
      await tx.studentGroupMember.deleteMany({
        where: {
          groupId,
          studentId: { in: data.removeStudentIds },
        },
      });
    }

    return tx.studentGroup.findUnique({
      where: { id: groupId },
      include: { members: { include: { student: { select: { id: true, name: true } } } } },
    });
  });
}

export async function deleteGroup(groupId: string, teacherId: string) {
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
  if (!group || group.teacherId !== teacherId) {
    throw new Error("FORBIDDEN");
  }
  return prisma.studentGroup.delete({ where: { id: groupId } });
}
