import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import { getSubmissionById, resetSubmissionForRetry } from "@/lib/services/submission.service";
import { success, handleServiceError, notFound } from "@/lib/api-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const submission = await getSubmissionById(id);
    if (!submission) return notFound("提交不存在");
    if (submission.status === "graded") {
      throw new Error("SUBMISSION_RETRY_NOT_ALLOWED");
    }

    if (submission.status === "failed") {
      await resetSubmissionForRetry(id);
    }

    const job = await enqueueAsyncJob({
      type: "submission_grade",
      entityType: "Submission",
      entityId: id,
      input: { submissionId: id, retriedBy: user.id },
      createdBy: user.id,
    });

    return success(job);
  } catch (err) {
    return handleServiceError(err);
  }
}
