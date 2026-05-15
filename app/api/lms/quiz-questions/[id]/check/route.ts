import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { assertTaskInstanceReadable } from "@/lib/auth/resource-access";
import { success, error, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";

const requestSchema = z.object({
  // Codex-P1-3 r2: 必填 taskInstanceId 防 question UUID 单点暴露答案
  taskInstanceId: z.string().uuid(),
  selectedOptionIds: z.array(z.string()).optional(),
  textAnswer: z.string().optional(),
});

/**
 * Unit 8 · 判定单题答对/答错
 *
 * POST /api/lms/quiz-questions/{id}/check
 * body: { taskInstanceId, selectedOptionIds?, textAnswer? }
 * 返回 { correct: boolean, correctOptionIds: string[] }
 *
 * 仅用于 adaptive 模式下单题即时判定，不写库。
 * short_answer 类型在 adaptive 模式当前简化为"非空即对"（评分留给 grading.service AI 兜底）；
 * 这样能让 adaptive 引擎走完流程，最终 mastery 报告依赖客观题。
 *
 * Codex-P1-3 r2 (489aa8e + this r2): 加 taskInstanceId required + assertTaskInstanceReadable
 * strict + question.taskId === instance.taskId 防伪造。防任何登录学生拿 question UUID
 * 单点暴露答案 → adaptive 学生预取答案再答题。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user } = auth.session;

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return error("VALIDATION_ERROR", "请求参数不正确", 400);
    }
    const taskInstanceId = parsed.data.taskInstanceId;

    // 校验学生班级 access (strict, 不 opt-in)
    await assertTaskInstanceReadable(taskInstanceId, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });

    const question = await prisma.quizQuestion.findUnique({
      where: { id },
      select: {
        taskId: true,
        type: true,
        correctOptionIds: true,
        correctAnswer: true,
      },
    });
    if (!question) return error("QUESTION_NOT_FOUND", "题目不存在", 404);

    // 防伪造：question.taskId 必须等于 instance.taskId
    const instance = await prisma.taskInstance.findUnique({
      where: { id: taskInstanceId },
      select: { taskId: true },
    });
    if (!instance) return error("TASK_INSTANCE_NOT_FOUND", "任务实例不存在", 404);
    if (instance.taskId !== question.taskId) {
      return error("FORBIDDEN", "题目与任务实例不匹配", 403);
    }

    if (question.type === "short_answer") {
      const ans = (parsed.data.textAnswer ?? "").trim();
      return success({
        correct: ans.length > 0,
        correctOptionIds: [],
      });
    }

    const submittedIds = parsed.data.selectedOptionIds ?? [];
    const correctSet = new Set(question.correctOptionIds);
    const correct =
      submittedIds.length === correctSet.size &&
      submittedIds.every((id) => correctSet.has(id));

    return success({
      correct,
      correctOptionIds: question.correctOptionIds,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
