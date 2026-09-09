import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { gradingTaskInclude, resolveGradingTask, freezeTask, type GradingTask } from "./task-version";
import { buildAdaptiveState, buildMasteryReport, selectNextQuestion, shouldStop } from "./quiz-adaptive.service";

interface CheckedAnswer { questionId: string; selectedOptionIds?: string[]; textAnswer?: string; correct: boolean; grade?: { score: number; maxScore: number; correct: boolean; comment: string } }
function taskFromAttempt(snapshot: Prisma.JsonValue): GradingTask { return snapshot as unknown as GradingTask; }
function settings(task: GradingTask) { return { maxQuestions: task.quizConfig?.maxQuestions ?? 8, startDifficulty: task.quizConfig?.startDifficulty ?? 5, difficultyStep: task.quizConfig?.difficultyStep ?? 1 }; }
function publicQuestion(q: GradingTask["quizQuestions"][number]) { return { id: q.id, type: q.type, prompt: q.prompt, options: q.options, points: q.points }; }

export async function nextQuizQuestion(taskId: string, instanceId: string, userId: string, attemptId?: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "TaskInstance" WHERE id = ${instanceId} FOR UPDATE`;
    const instance = await tx.taskInstance.findUnique({ where: { id: instanceId }, include: { task: { include: gradingTaskInclude } } });
    if (!instance || instance.taskId !== taskId) throw new Error("FORBIDDEN");
    const task = resolveGradingTask(instance.taskSnapshot, instance.task);
    if (task.quizConfig?.mode !== "adaptive") throw new Error("MODE_NOT_ADAPTIVE");
    let attempt = attemptId
      ? await tx.quizAttempt.findUnique({ where: { id: attemptId } })
      : await tx.quizAttempt.findFirst({ where: { studentId: userId, taskInstanceId: instanceId, completedAt: null }, orderBy: { createdAt: "desc" } });
    if (attempt && (attempt.studentId !== userId || attempt.taskInstanceId !== instanceId)) throw new Error("FORBIDDEN");
    if (!attempt) {
      if (attemptId) throw new Error("QUIZ_ATTEMPT_NOT_FOUND");
      attempt = await tx.quizAttempt.create({ data: { studentId: userId, taskInstanceId: instanceId, taskSnapshot: freezeTask(task), issuedQuestionIds: [], answers: [] } });
    }
    const frozen = taskFromAttempt(attempt.taskSnapshot);
    const history = attempt.answers as unknown as CheckedAnswer[];
    const config = settings(frozen);
    const state = buildAdaptiveState(history, frozen.quizQuestions, config);
    const unansweredId = attempt.issuedQuestionIds.find(id => !history.some(a => a.questionId === id));
    const next = unansweredId ? frozen.quizQuestions.find(q => q.id === unansweredId) : selectNextQuestion(state, frozen.quizQuestions, config);
    if (attempt.completedAt || (!unansweredId && (shouldStop(state, config) || !next))) {
      await tx.quizAttempt.update({ where: { id: attempt.id }, data: { completedAt: attempt.completedAt ?? new Date() } });
      return { attemptId: attempt.id, done: true, masteryReport: buildMasteryReport(state, history) };
    }
    const question = frozen.quizQuestions.find(q => q.id === next?.id);
    if (!question) throw new Error("QUESTION_NOT_FOUND");
    if (!unansweredId) await tx.quizAttempt.update({ where: { id: attempt.id }, data: { issuedQuestionIds: { push: question.id } } });
    return { attemptId: attempt.id, done: false, nextQuestion: publicQuestion(question), progress: { answered: history.length, maxQuestions: config.maxQuestions, coveredKnowledgePoints: state.abilities.size } };
  });
}

export async function checkQuizAttemptAnswer(attemptId: string, instanceId: string, userId: string, questionId: string, answer: { selectedOptionIds?: string[]; textAnswer?: string }) {
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId }, include: { taskInstance: { select: { createdBy: true } } } });
  if (!attempt || attempt.studentId !== userId || attempt.taskInstanceId !== instanceId || !attempt.issuedQuestionIds.includes(questionId)) throw new Error("FORBIDDEN");
  const task = taskFromAttempt(attempt.taskSnapshot);
  if (task.quizConfig?.mode !== "adaptive") throw new Error("MODE_NOT_ADAPTIVE");
  const question = task.quizQuestions.find(q => q.id === questionId);
  if (!question) throw new Error("QUESTION_NOT_FOUND");
  const prior = (attempt.answers as unknown as CheckedAnswer[]).find(a => a.questionId === questionId);
  let checked: CheckedAnswer;
  if (prior) checked = prior;
  else if (question.type === "short_answer") {
    if (!answer.textAnswer?.trim()) throw new Error("SUBMISSION_CONTENT_REQUIRED");
    const { gradeShortAnswer } = await import("./grading.service");
    const grade = await gradeShortAnswer(userId, attempt.taskInstance.createdBy, question.prompt, answer.textAnswer, question.correctAnswer ?? "", question.points);
    checked = { questionId, textAnswer: answer.textAnswer, correct: grade.correct, grade };
  } else {
    const ids = [...new Set(answer.selectedOptionIds ?? [])].sort();
    const correct = [...question.correctOptionIds].sort();
    checked = { questionId, selectedOptionIds: ids, correct: JSON.stringify(ids) === JSON.stringify(correct) };
  }
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "QuizAttempt" WHERE id = ${attemptId} FOR UPDATE`;
    const current = await tx.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!current || current.completedAt) throw new Error("QUIZ_ATTEMPT_COMPLETE");
    const answers = current.answers as unknown as CheckedAnswer[];
    const stored = answers.find(a => a.questionId === questionId) ?? checked;
    if (!answers.some(a => a.questionId === questionId)) await tx.quizAttempt.update({ where: { id: attemptId }, data: { answers: [...answers, checked] as unknown as Prisma.InputJsonValue } });
    return { correct: stored.correct, correctOptionIds: question.correctOptionIds };
  });
}
