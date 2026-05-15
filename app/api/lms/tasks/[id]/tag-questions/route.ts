import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { success, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import { getUntaggedCount } from "@/lib/services/quiz-question-tagger.service";

/**
 * Unit 8 · 触发 quiz_question_tag async job
 *
 * POST /api/lms/tasks/{id}/tag-questions
 *
 * 教师或 owner 调用；返回 { jobId, untaggedCount }
 * 自动幂等：已 tag 的 question 不重复打标
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;
  try {
    const result = await requireRole(["teacher", "admin"]);
    if (result.error) return result.error;
    const { user } = result.session;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, taskType: true, creatorId: true },
    });
    if (!task) return handleServiceError(new Error("TASK_NOT_FOUND"));
    if (task.taskType !== "quiz") return handleServiceError(new Error("TASK_NOT_QUIZ"));

    // 权限：creator 或 admin（教师之间通常不分享单个 task 的写权限）
    if (task.creatorId !== user.id && user.role !== "admin") {
      return handleServiceError(new Error("FORBIDDEN"));
    }

    const untagged = await getUntaggedCount(taskId);
    if (untagged === 0) {
      return success({ jobId: null, untaggedCount: 0, message: "全部题目已 tag，无需重新处理" });
    }

    const job = await enqueueAsyncJob({
      type: "quiz_question_tag",
      entityType: "task",
      entityId: taskId,
      input: { taskId },
      createdBy: user.id,
    });

    return success({ jobId: job.id, untaggedCount: untagged });
  } catch (err) {
    return handleServiceError(err);
  }
}

/** GET 返回当前 task 下未 tag 的题目数 + 最近一次 tag job 状态（供学生侧显示"准备中"） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;
  try {
    const result = await requireRole(["teacher", "admin", "student"]);
    if (result.error) return result.error;

    const untagged = await getUntaggedCount(taskId);
    const latestJob = await prisma.asyncJob.findFirst({
      where: { type: "quiz_question_tag", entityId: taskId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, progress: true, error: true, createdAt: true },
    });

    return success({
      untaggedCount: untagged,
      latestJob: latestJob ?? null,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
