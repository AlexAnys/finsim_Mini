import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { updateTaskInstanceSnapshot } from "@/lib/services/task-instance.service";
import { updateTaskInstanceSnapshotSchema } from "@/lib/validators/task.schema";
import { success, validationError, handleServiceError } from "@/lib/api-utils";

// Unit A1: 教师在 instance overview 编辑学生看到的配置（写 taskSnapshot）
// - 不动 task 模板（仅本 instance 的快照）
// - service 守 task.id / taskType / taskName 不变，并按 taskType 三态合并
// - 返回 { instance, gradedCount }，UI 用 gradedCount 显示已批改警告
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTaskInstanceSnapshotSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }
    const { user } = result.session;
    const data = await updateTaskInstanceSnapshot(id, user.id, parsed.data, user.role);
    return success(data);
  } catch (err) {
    return handleServiceError(err);
  }
}
