import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { success, error, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import {
  buildAdaptiveState,
  buildMasteryReport,
  selectNextQuestion,
  shouldStop,
  type AdaptiveQuestionBank,
  type AdaptiveQuizConfig,
} from "@/lib/services/quiz-adaptive.service";

const requestSchema = z.object({
  history: z.array(
    z.object({
      questionId: z.string(),
      correct: z.boolean(),
    }),
  ),
});

/**
 * Unit 8 · adaptive quiz 下一题选取
 *
 * POST /api/lms/tasks/{taskId}/adaptive-quiz/next
 * body: { history: [{questionId, correct}] }
 * → 200 { done: false, nextQuestion: {...} } 或
 *   200 { done: true, masteryReport: {...} } 或
 *   200 { fallback: "fixed", reason: "..." } 当 question 未 tag 时
 *
 * 服务端无状态：每次请求带完整 history，引擎重算。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;
  try {
    const result = await requireAuth();
    if (result.error) return result.error;

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return error("VALIDATION_ERROR", "请求参数不正确", 400);
    }
    const history = parsed.data.history;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        quizConfig: true,
        quizQuestions: { orderBy: { order: "asc" } },
      },
    });
    if (!task) return error("TASK_NOT_FOUND", "任务不存在", 404);
    if (task.taskType !== "quiz" || !task.quizConfig) {
      return error("TASK_NOT_QUIZ", "该任务不是测验类型", 400);
    }
    if (task.quizConfig.mode !== "adaptive") {
      return error("MODE_NOT_ADAPTIVE", "该测验不是自适应模式", 400);
    }

    // 兼容性 fallback：若 ≥ 50% 的题没 tag，降级到 fixed 模式
    const taggedCount = task.quizQuestions.filter(
      (q) => q.knowledgeTagIds.length > 0,
    ).length;
    if (
      task.quizQuestions.length > 0 &&
      taggedCount / task.quizQuestions.length < 0.5
    ) {
      return success({
        fallback: "fixed",
        reason: "本测验暂未配置知识点诊断（教师可在任务详情触发），将以普通模式作答",
        questions: task.quizQuestions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          points: q.points,
        })),
      });
    }

    const bank: AdaptiveQuestionBank[] = task.quizQuestions.map((q) => ({
      id: q.id,
      type: q.type as AdaptiveQuestionBank["type"],
      difficulty: q.difficulty,
      knowledgeTagIds: q.knowledgeTagIds,
    }));

    const config: AdaptiveQuizConfig = {
      maxQuestions: task.quizConfig.maxQuestions ?? 8,
      startDifficulty: task.quizConfig.startDifficulty ?? 5,
      difficultyStep: task.quizConfig.difficultyStep ?? 1,
    };

    const state = buildAdaptiveState(history, bank, config);

    if (shouldStop(state, config)) {
      const report = buildMasteryReport(state, history);
      return success({ done: true, masteryReport: report });
    }

    const next = selectNextQuestion(state, bank, config);
    if (!next) {
      // 题库耗尽
      const report = buildMasteryReport(state, history);
      return success({ done: true, masteryReport: report, exhausted: true });
    }

    // 返回完整题面（学生端答题用）
    const fullQuestion = task.quizQuestions.find((q) => q.id === next.id);
    if (!fullQuestion) return error("QUESTION_NOT_FOUND", "下一题不存在", 500);

    return success({
      done: false,
      nextQuestion: {
        id: fullQuestion.id,
        type: fullQuestion.type,
        prompt: fullQuestion.prompt,
        options: fullQuestion.options,
        points: fullQuestion.points,
      },
      progress: {
        answered: state.answeredIds.size,
        maxQuestions: config.maxQuestions,
        coveredKnowledgePoints: state.abilities.size,
      },
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
