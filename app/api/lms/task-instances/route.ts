import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createTaskInstance, getTaskInstances } from "@/lib/services/task-instance.service";
import { createTaskInstanceSchema } from "@/lib/validators/task.schema";
import {
  assertTaskReadable,
} from "@/lib/auth/resource-access";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { prisma } from "@/lib/db/prisma";
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

    const { user } = result.session;
    const data = parsed.data;

    // PR-FIX-1 A1: 防教师反向读他人 task / 写他人 course / 跨班挂载
    await assertTaskReadable(data.taskId, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    if (data.courseId) {
      await assertCourseAccess(data.courseId, user.id, user.role);
      // 验证 classId 属于该课程（主班或 CourseClass）
      const cls = await prisma.course.findUnique({
        where: { id: data.courseId },
        select: {
          classId: true,
          classes: { select: { classId: true } },
        },
      });
      if (!cls) throw new Error("COURSE_NOT_FOUND");
      const ok =
        cls.classId === data.classId ||
        cls.classes.some((cc) => cc.classId === data.classId);
      if (!ok) throw new Error("CLASS_COURSE_MISMATCH");
    }

    const instance = await createTaskInstance(user.id, data);
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
