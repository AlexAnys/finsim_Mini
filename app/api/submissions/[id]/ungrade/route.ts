import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import { ungradeSubmission } from "@/lib/services/submission.service";
import { success, handleServiceError } from "@/lib/api-utils";

/**
 * Unit 5b: 撤销批改 — graded -> submitted（保留 evaluation 数据供二次批改参考）
 * 权限：assertSubmissionReadable 兜底（teacher creator / collab via course / admin）
 */
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
    await ungradeSubmission(id, user.id);
    return success({ ungraded: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
