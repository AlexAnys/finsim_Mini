import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { getSubmissionById, deleteSubmission } from "@/lib/services/submission.service";
import { success, notFound, handleServiceError } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { id } = await params;
  const submission = await getSubmissionById(id);
  if (!submission) return notFound("提交不存在");
  return success(submission);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await deleteSubmission(id);
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
