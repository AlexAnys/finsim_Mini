import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { assertTaskReadable } from "@/lib/auth/resource-access";
import { getTaskById, updateTask, deleteTask } from "@/lib/services/task.service";
import { updateTaskSchema } from "@/lib/validators/task.schema";
import { success, notFound, validationError, handleServiceError } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertTaskReadable(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    const task = await getTaskById(id);
    if (!task) return notFound("任务不存在");
    return success(task);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const task = await updateTask(id, result.session.user.id, parsed.data);
    return success(task);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await deleteTask(id, result.session.user.id);
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
