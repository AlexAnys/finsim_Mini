import { prisma } from "@/lib/db/prisma";
import { assertClassAccessForTeacher } from "@/lib/auth/resource-access";
import { managedClassWhere } from "@/lib/auth/class-scope";
import { clampPage, clampTake } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

type UserLike = { id: string; role: string; classId?: string | null };

async function assertStudentsInClass(
  tx: Prisma.TransactionClient,
  classId: string,
  studentIds: string[] | undefined,
) {
  const uniqueIds = Array.from(new Set(studentIds ?? []));
  if (uniqueIds.length === 0) return;

  const students = await tx.user.findMany({
    where: { id: { in: uniqueIds }, role: "student", classId },
    select: { id: true },
  });
  if (students.length !== uniqueIds.length) {
    throw new Error("GROUP_MEMBER_CLASS_MISMATCH");
  }
}

type CreateGroupInput = {
  user: UserLike;
  classId: string;
  name: string;
  type: "manual" | "auto_score_bucket";
  meta?: Record<string, unknown>;
  studentIds?: string[];
};

/** Shared by the standalone form and roster dialog; repeated same-name creation reuses the group. */
export async function createGroupInTransaction(tx: Prisma.TransactionClient, data: CreateGroupInput) {
  await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${data.classId} FOR UPDATE`;
  await assertClassAccessForTeacher(data.classId, data.user, tx);
  await assertStudentsInClass(tx, data.classId, data.studentIds);
  const name = data.name.trim();
  if (!name) throw new Error("ROSTER_INVALID_INPUT");
  const existing = await tx.studentGroup.findFirst({
    where: { teacherId: data.user.id, classId: data.classId, name },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const group = existing ?? await tx.studentGroup.create({
    data: {
      teacherId: data.user.id, classId: data.classId, name, type: data.type,
      meta: (data.meta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  if (data.studentIds?.length) {
    await tx.studentGroupMember.createMany({
      data: [...new Set(data.studentIds)].map((studentId) => ({ groupId: group.id, studentId })),
      skipDuplicates: true,
    });
  }
  return group;
}

export async function createGroup(data: CreateGroupInput) {
  await assertClassAccessForTeacher(data.classId, data.user);
  return prisma.$transaction((tx) => createGroupInTransaction(tx, data));
}

export async function getGroupsByUser(
  user: UserLike,
  options: { take?: number; page?: number } = {},
) {
  return prisma.studentGroup.findMany({
    where: { ...(user.role === "admin" ? {} : { teacherId: user.id }), class: managedClassWhere(user) },
    include: {
      class: { select: { id: true, name: true } },
      members: {
        include: {
          student: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { members: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: clampTake(options.take, 100, 200),
    skip: (clampPage(options.page) - 1) * clampTake(options.take, 100, 200),
  });
}

export async function updateGroup(
  groupId: string,
  user: UserLike,
  data: {
    name?: string;
    addStudentIds?: string[];
    removeStudentIds?: string[];
  }
) {
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("GROUP_NOT_FOUND");
  if (user.role !== "admin" && group.teacherId !== user.id) {
    throw new Error("FORBIDDEN");
  }
  await assertClassAccessForTeacher(group.classId, user);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${group.classId} FOR UPDATE`;
    await assertClassAccessForTeacher(group.classId, user, tx);
    await assertStudentsInClass(tx, group.classId, data.addStudentIds);

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
  return deleteGroupForUser(groupId, { id: teacherId, role: "teacher" });
}

export async function deleteGroupForUser(groupId: string, user: UserLike) {
  const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("GROUP_NOT_FOUND");
  if (user.role !== "admin" && group.teacherId !== user.id) {
    throw new Error("FORBIDDEN");
  }
  await assertClassAccessForTeacher(group.classId, user);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${group.classId} FOR UPDATE`;
    await assertClassAccessForTeacher(group.classId, user, tx);
    return tx.studentGroup.delete({ where: { id: groupId } });
  });
}
