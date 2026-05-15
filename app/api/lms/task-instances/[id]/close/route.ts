import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { closeTaskInstance } from "@/lib/services/task-instance.service";
import { success, handleServiceError } from "@/lib/api-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const instance = await closeTaskInstance(id, result.session.user.id);
    return success(instance);
  } catch (err) {
    return handleServiceError(err);
  }
}
