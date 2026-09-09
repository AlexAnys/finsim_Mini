import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import { retrySubmissionGrading } from "@/lib/services/submission.service";
import { success, handleServiceError } from "@/lib/api-utils";

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

    const job = await retrySubmissionGrading(id, user);

    return success(job);
  } catch (err) {
    return handleServiceError(err);
  }
}
