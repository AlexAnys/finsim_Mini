import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { handleServiceError, success } from "@/lib/api-utils";
import { retryCourseKnowledgeSource } from "@/lib/services/course-knowledge-source.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const user = result.session.user;
    const source = await retryCourseKnowledgeSource({
      id,
      userId: user.id,
      role: user.role,
    });
    return success(source);
  } catch (err) {
    return handleServiceError(err);
  }
}
