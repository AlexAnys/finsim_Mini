import { prisma } from "@/lib/db/prisma";
import { clampTake } from "@/lib/pagination";

export async function listRegistrationClasses(options: { take?: number } = {}) {
  return prisma.class.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      academicYear: true,
    },
    orderBy: { name: "asc" },
    take: clampTake(options.take, 100, 200),
  });
}

export async function listClassesForStaff(options: { take?: number } = {}) {
  return prisma.class.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { students: true } },
    },
    take: clampTake(options.take, 100, 200),
  });
}

export async function listClassMembers(classId: string, options: { take?: number } = {}) {
  return prisma.user.findMany({
    where: { classId, role: "student" },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
    take: clampTake(options.take, 100, 200),
  });
}
