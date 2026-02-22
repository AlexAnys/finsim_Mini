import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createTaskInstance, getTaskInstances } from "@/lib/services/task-instance.service";
import { createTaskInstanceSchema } from "@/lib/validators/task.schema";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createTaskInstanceSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const instance = await createTaskInstance(result.session.user.id, parsed.data);
    return created(instance);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId") || undefined;
  const classId = searchParams.get("classId") || undefined;
  const status = searchParams.get("status") || undefined;

  try {
    const filters: Record<string, string | undefined> = { courseId, classId, status };
    if (result.session.user.role === "teacher") {
      filters.createdBy = result.session.user.id;
    }

    const instances = await getTaskInstances(filters);
    return success(instances);
  } catch (err) {
    return handleServiceError(err);
  }
}
