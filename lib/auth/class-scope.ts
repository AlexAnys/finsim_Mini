import type { Prisma } from "@prisma/client";

/** Same scope as assertClassAccessForTeacher: creator or an owning/collaborating course. */
export function managedClassWhere(user: { id: string; role: string }): Prisma.ClassWhereInput {
  if (user.role === "admin") return {};
  if (user.role !== "teacher") throw new Error("FORBIDDEN");
  const teaching = { OR: [{ createdBy: user.id }, { teachers: { some: { teacherId: user.id } } }] };
  return { OR: [
    { createdBy: user.id },
    { courses: { some: teaching } },
    { courseClasses: { some: { course: teaching } } },
  ] };
}
