import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { getCourseClasses, addCourseClass, removeCourseClass } from "@/lib/services/course.service";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

async function assertCourseAccess(courseId: string, userId: string, userRole: string) {
  if (userRole === "admin") return;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (course.createdBy === userId) return;
  // Check if user is a collaborative teacher
  const ct = await prisma.courseTeacher.findUnique({
    where: { courseId_teacherId: { courseId, teacherId: userId } },
  });
  if (!ct) throw new Error("FORBIDDEN");
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const classes = await getCourseClasses(id);
    return success(classes);
  } catch (err) {
    return handleServiceError(err);
  }
}

const addSchema = z.object({ classId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await assertCourseAccess(id, result.session.user.id, result.session.user.role);

    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return validationError("请提供有效的班级 ID", parsed.error.flatten());

    const cc = await addCourseClass(id, parsed.data.classId);
    return success(cc);
  } catch (err) {
    return handleServiceError(err);
  }
}

const deleteSchema = z.object({ classId: z.string().uuid() });

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await assertCourseAccess(id, result.session.user.id, result.session.user.role);

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return validationError("请提供班级 ID", parsed.error.flatten());

    await removeCourseClass(id, parsed.data.classId);
    return success({ removed: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
