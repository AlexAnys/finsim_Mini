import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { restoreCourse } from "@/lib/services/course.service";
import { success, handleServiceError } from "@/lib/api-utils";

// 从回收站恢复已归档课程。业务逻辑（owner/admin 守卫 + 清 deletedAt + audit）在 Service。
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await restoreCourse(id, result.session.user.id, result.session.user.role);
    return success({ restored: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
