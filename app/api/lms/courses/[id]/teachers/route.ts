import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { getCourseTeachers, addCourseTeacher, removeCourseTeacher } from "@/lib/services/course.service";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

async function assertCourseOwnerOrAdmin(courseId: string, userId: string, userRole: string) {
  if (userRole === "admin") return;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.createdBy !== userId) {
    throw new Error("FORBIDDEN");
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const teachers = await getCourseTeachers(id);
    return success(teachers);
  } catch (err) {
    return handleServiceError(err);
  }
}

const addSchema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await assertCourseOwnerOrAdmin(id, result.session.user.id, result.session.user.role);

    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return validationError("请提供有效的教师邮箱", parsed.error.flatten());

    const ct = await addCourseTeacher(id, parsed.data.email);
    return success(ct);
  } catch (err) {
    return handleServiceError(err);
  }
}

const deleteSchema = z.object({ teacherId: z.string().uuid() });

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await assertCourseOwnerOrAdmin(id, result.session.user.id, result.session.user.role);

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return validationError("请提供教师 ID", parsed.error.flatten());

    await removeCourseTeacher(id, parsed.data.teacherId);
    return success({ removed: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
