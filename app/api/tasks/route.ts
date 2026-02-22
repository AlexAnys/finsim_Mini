import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createTask, getTasksByCreator } from "@/lib/services/task.service";
import { createTaskSchema } from "@/lib/validators/task.schema";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const task = await createTask(result.session.user.id, parsed.data);
    return created(task);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET() {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const tasks = await getTasksByCreator(result.session.user.id);
    return success(tasks);
  } catch (err) {
    return handleServiceError(err);
  }
}
