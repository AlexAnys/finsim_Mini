import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { handleServiceError, success } from "@/lib/api-utils";
import {
  approveTaskBuildDraft,
  getTaskBuildDraft,
} from "@/lib/services/task-build-draft.service";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const existing = await getTaskBuildDraft(id);
    await assertCourseAccess(
      existing.courseId,
      result.session.user.id,
      result.session.user.role,
    );

    const draft = await approveTaskBuildDraft(id, result.session.user.id);
    return success(draft);
  } catch (err) {
    return handleServiceError(err);
  }
}
