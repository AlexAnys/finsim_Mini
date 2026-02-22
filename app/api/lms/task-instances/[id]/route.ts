import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { updateTaskInstance, deleteTaskInstance, getTaskInstanceById } from "@/lib/services/task-instance.service";
import { updateTaskInstanceSchema } from "@/lib/validators/task.schema";
import { success, notFound, validationError, handleServiceError } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin", "student"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const instance = await getTaskInstanceById(id);
    if (!instance) return notFound("任务实例不存在");
    return success(instance);
  } catch (err) {
    console.error("[task-instance GET] Error:", err);
    return handleServiceError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTaskInstanceSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const instance = await updateTaskInstance(id, result.session.user.id, parsed.data);
    return success(instance);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await deleteTaskInstance(id, result.session.user.id);
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
