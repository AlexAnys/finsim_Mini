import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { clampTake } from "@/lib/pagination";

export async function createClass(input: {
  name: string;
  academicYear?: string | null;
  createdBy: string;
}) {
  const name = input.name.trim();
  const academicYear = input.academicYear?.trim() || null;
  try {
    return await prisma.class.create({
      data: { name, academicYear, createdBy: input.createdBy },
      include: {
        _count: { select: { students: true } },
      },
    });
  } catch (err) {
    // name 全局 @unique：撞名抛 P2002 → 友好领域错误码（API 层映射为 409）。
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("CLASS_NAME_EXISTS");
    }
    throw err;
  }
}

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
