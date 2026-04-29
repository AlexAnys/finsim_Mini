import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { prisma } from "@/lib/db/prisma";
import { success, notFound, handleServiceError } from "@/lib/api-utils";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const slot = await prisma.scheduleSlot.findUnique({ where: { id } });
    if (!slot) return notFound("课表时段不存在");
    await assertCourseAccess(
      slot.courseId,
      result.session.user.id,
      result.session.user.role,
    );
    await prisma.scheduleSlot.delete({ where: { id } });
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
