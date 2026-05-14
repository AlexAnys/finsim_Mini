import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { prisma } from "@/lib/db/prisma";
import { createPublishedTaskWithInstance } from "@/lib/services/task-instance.service";
import {
  getTaskBuildDraft,
  markTaskBuildDraftPublished,
} from "@/lib/services/task-build-draft.service";
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

    // Unit 10: 若发布请求带 taskBuildDraftId，必须验证 draft.status === "approved"
    // 手工创建任务（无 draft）不受此约束
    if (data.taskBuildDraftId) {
      const draft = await getTaskBuildDraft(data.taskBuildDraftId);
      if (draft.courseId !== data.instance.courseId) {
        throw new Error("TASK_BUILD_DRAFT_SCOPE_MISMATCH");
      }
      if (draft.status !== "approved") {
        throw new Error("TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH");
      }
    }

    const output = await createPublishedTaskWithInstance(user.id, data);
    await logAudit({
      action: "taskInstance.createWithTask.publish",
      actorId: user.id,
      targetId: output.instance.id,
      targetType: "TaskInstance",
      metadata: {
        taskId: output.task.id,
        ...(data.taskBuildDraftId && { taskBuildDraftId: data.taskBuildDraftId }),
      },
    });

    if (data.taskBuildDraftId) {
      await markTaskBuildDraftPublished(data.taskBuildDraftId);
    }

    return created(output);
  } catch (err) {
    return handleServiceError(err);
  }
}
