import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { prisma } from "@/lib/db/prisma";
import { createPublishedTaskWithInstance } from "@/lib/services/task-instance.service";
import { logAudit } from "@/lib/services/audit.service";
import { createPublishedTaskWithInstanceSchema } from "@/lib/validators/task.schema";
import { created, validationError, handleServiceError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createPublishedTaskWithInstanceSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    const data = parsed.data;
    if (!data.instance.courseId) {
      return validationError("courseId 必填");
    }

    await assertCourseAccess(data.instance.courseId, user.id, user.role);
    const course = await prisma.course.findUnique({
      where: { id: data.instance.courseId },
      select: {
        classId: true,
        classes: { select: { classId: true } },
      },
    });
    if (!course) throw new Error("COURSE_NOT_FOUND");
    const classMatches =
      course.classId === data.instance.classId ||
      course.classes.some((cc) => cc.classId === data.instance.classId);
    if (!classMatches) throw new Error("CLASS_COURSE_MISMATCH");

    const output = await createPublishedTaskWithInstance(user.id, data);
    await logAudit({
      action: "taskInstance.createWithTask.publish",
      actorId: user.id,
      targetId: output.instance.id,
      targetType: "TaskInstance",
      metadata: { taskId: output.task.id },
    });

    return created(output);
  } catch (err) {
    return handleServiceError(err);
  }
}
