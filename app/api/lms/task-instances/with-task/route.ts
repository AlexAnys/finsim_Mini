import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { getCourseActorRole } from "@/lib/auth/actor-role";
import { prisma } from "@/lib/db/prisma";
import {
  createPublishedTaskWithInstance,
  createPublishedTaskWithInstanceInTransaction,
} from "@/lib/services/task-instance.service";
import {
  getTaskBuildDraft,
  markTaskBuildDraftPublishedFromWizard,
} from "@/lib/services/task-build-draft.service";
import { logAuditEvent } from "@/lib/services/audit.service";
import { createPublishedTaskWithInstanceSchema } from "@/lib/validators/task.schema";
import { created, validationError, handleServiceError } from "@/lib/api-utils";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";

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
        classes: { select: { classId: true } },
      },
    });
    if (!course) throw new Error("COURSE_NOT_FOUND");
    const classMatches = course.classes.some((cc) => cc.classId === data.instance.classId);
    if (!classMatches) throw new Error("CLASS_COURSE_MISMATCH");

    // PR-15 bug 1: wizard 发布 draft 路径放宽到 (draft/ready/approved) 三态。
    // 旧路径（审核页 → 课程页 publish）仍走严格 approved-only `markTaskBuildDraftPublished`，
    // 但 with-task 是当前唯一调用方，统一改成 wizard 兼容版本。
    // 手工创建任务（无 draft）不受此约束。
    // 注：scope 校验保留前置（友好错误），真正的 status flip 在 transaction 内做 atomic
    if (data.taskBuildDraftId) {
      const draft = await getTaskBuildDraft(data.taskBuildDraftId);
      if (draft.courseId !== data.instance.courseId) {
        throw new Error("TASK_BUILD_DRAFT_SCOPE_MISMATCH");
      }
    }

    // Codex-P1-r4: atomic publish — 把 draft status flip + create task+instance 包同一 transaction，
    // 防并发请求两个老师同时 publish 同一 draft 时只有一个 flip 成功但两个 instance 都已持久化。
    // conditional update `where: { id, status: { in: [...] } }` 让 status 转换在 DB 层面 atomic；
    // race loser 抛 P2025 → 整个 transaction 回滚 → 不创 instance。
    let output: Awaited<ReturnType<typeof createPublishedTaskWithInstance>>;
    let needsTaggerJob = false;
    if (data.taskBuildDraftId) {
      output = await prisma.$transaction(async (tx) => {
        await markTaskBuildDraftPublishedFromWizard(data.taskBuildDraftId!, tx);
        return createPublishedTaskWithInstanceInTransaction(tx, user.id, data);
      });
      needsTaggerJob =
        data.task.taskType === "quiz" &&
        data.task.quizConfig?.mode === "adaptive" &&
        (data.task.quizQuestions?.length ?? 0) > 0;
    } else {
      output = await createPublishedTaskWithInstance(user.id, data);
    }

    const actorRole = await getCourseActorRole(
      data.instance.courseId,
      user.id,
      user.role,
    );
    await logAuditEvent({
      action: "task_instance.create_with_task.publish",
      actorRole,
      actorId: user.id,
      targetId: output.instance.id,
      targetType: "TaskInstance",
      metadata: {
        taskId: output.task.id,
        ...(data.taskBuildDraftId && { taskBuildDraftId: data.taskBuildDraftId }),
      },
    });

    // Phase3-A · Root cause 1: adaptive quiz 自动 enqueue tagger job
    if (needsTaggerJob) {
      try {
        await enqueueAsyncJob({
          type: "quiz_question_tag",
          entityType: "task",
          entityId: output.task.id,
          input: { taskId: output.task.id },
          createdBy: user.id,
        });
      } catch (err) {
        console.error(
          "[with-task] 自动触发 quiz_question_tag 失败（不阻塞）：",
          err,
        );
      }
    }

    return created(output);
  } catch (err) {
    return handleServiceError(err);
  }
}
