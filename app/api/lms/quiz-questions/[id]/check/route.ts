import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { success, error, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";

const requestSchema = z.object({
  selectedOptionIds: z.array(z.string()).optional(),
  textAnswer: z.string().optional(),
});

/**
 * Unit 8 · 判定单题答对/答错
 *
 * POST /api/lms/quiz-questions/{id}/check
 * body: { selectedOptionIds?, textAnswer? }
 * 返回 { correct: boolean, correctOptionIds: string[] }
 *
 * 仅用于 adaptive 模式下单题即时判定，不写库。
 * short_answer 类型在 adaptive 模式当前简化为"非空即对"（评分留给 grading.service AI 兜底）；
 * 这样能让 adaptive 引擎走完流程，最终 mastery 报告依赖客观题。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return error("VALIDATION_ERROR", "请求参数不正确", 400);
    }

    const question = await prisma.quizQuestion.findUnique({
      where: { id },
      select: {
        type: true,
        correctOptionIds: true,
        correctAnswer: true,
      },
    });
    if (!question) return error("QUESTION_NOT_FOUND", "题目不存在", 404);

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
