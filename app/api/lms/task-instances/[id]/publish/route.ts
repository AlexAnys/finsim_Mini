import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { publishTaskInstance } from "@/lib/services/task-instance.service";
import { logAuditEvent } from "@/lib/services/audit.service";
import { getCourseActorRole } from "@/lib/auth/actor-role";
import { prisma } from "@/lib/db/prisma";
import { success, handleServiceError } from "@/lib/api-utils";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    const instance = await publishTaskInstance(id, user.id, user.role);

    // PR-1 D: 推断 actorRole（publish 是高危状态变更，必须留痕）
    const instRec = await prisma.taskInstance.findUnique({
      where: { id },
      select: { courseId: true },
    });
    const actorRole = instRec?.courseId
      ? await getCourseActorRole(instRec.courseId, user.id, user.role)
      : user.role === "admin"
        ? "admin"
        : "owner";

    await logAuditEvent({
      action: "task_instance.publish",
      actorRole,
      actorId: user.id,
      targetId: id,
      targetType: "TaskInstance",
    });

    return success(instance);
  } catch (err) {
    return handleServiceError(err);
  }
}
