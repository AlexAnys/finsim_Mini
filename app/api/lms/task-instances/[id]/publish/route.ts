import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { publishTaskInstance } from "@/lib/services/task-instance.service";
import { logAudit } from "@/lib/services/audit.service";
import { success, handleServiceError } from "@/lib/api-utils";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const instance = await publishTaskInstance(id, result.session.user.id);

    await logAudit({
      action: "taskInstance.publish",
      actorId: result.session.user.id,
      targetId: id,
      targetType: "TaskInstance",
    });

    return success(instance);
  } catch (err) {
    return handleServiceError(err);
  }
}
