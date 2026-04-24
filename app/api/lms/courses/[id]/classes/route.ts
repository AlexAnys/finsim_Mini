import { NextRequest } from "next/server";
import { requireRole, assertCourseAccess } from "@/lib/auth/guards";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { getCourseClasses, addCourseClass, removeCourseClass } from "@/lib/services/course.service";
import { z } from "zod";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await assertCourseAccess(id, result.session.user.id, result.session.user.role);
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
