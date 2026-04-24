import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import { getSubmissionById, deleteSubmission } from "@/lib/services/submission.service";
import { success, notFound, handleServiceError } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertSubmissionReadable(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    const submission = await getSubmissionById(id);
    if (!submission) return notFound("提交不存在");
    return success(submission);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertSubmissionReadable(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    await deleteSubmission(id);
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
