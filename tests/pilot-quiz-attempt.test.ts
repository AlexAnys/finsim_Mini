import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  $queryRaw: vi.fn(), $transaction: vi.fn(), taskInstance: { findUnique: vi.fn() },
  quizAttempt: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
} }));
import { prisma } from "@/lib/db/prisma";
import { nextQuizQuestion, checkQuizAttemptAnswer } from "@/lib/services/quiz-attempt.service";
const task = { id: "task", taskName: "测验", taskType: "quiz", quizConfig: { mode: "adaptive", maxQuestions: 1, startDifficulty: 5, difficultyStep: 1 }, quizQuestions: [
  { id: "q1", prompt: "题一", type: "single_choice", points: 1, difficulty: 3, knowledgeTagIds: ["风险"], options: [{ id: "A", text: "选项" }], correctOptionIds: ["A"] },
  { id: "q2", prompt: "题二", type: "single_choice", points: 1, difficulty: 3, knowledgeTagIds: ["风险"], options: [{ id: "A", text: "选项" }], correctOptionIds: ["A"] },
] };
let attempt: { id: string; studentId: string; taskInstanceId: string; taskSnapshot: typeof task; issuedQuestionIds: string[]; answers: Array<{ questionId: string; correct: boolean; selectedOptionIds?: string[] }>; completedAt: Date | null; taskInstance: { createdBy: string } };
const fn = (value: unknown) => value as ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  attempt = { id: "attempt", studentId: "student", taskInstanceId: "instance", taskSnapshot: structuredClone(task), issuedQuestionIds: [], answers: [], completedAt: null, taskInstance: { createdBy: "teacher" } };
  fn(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma));
  fn(prisma.taskInstance.findUnique).mockResolvedValue({ id: "instance", taskId: "task", taskSnapshot: task, task });
  fn(prisma.quizAttempt.findFirst).mockImplementation(async () => attempt);
  fn(prisma.quizAttempt.findUnique).mockImplementation(async () => attempt);
  fn(prisma.quizAttempt.update).mockImplementation(async ({ data }: { data: { issuedQuestionIds?: { push: string }; answers?: typeof attempt.answers; completedAt?: Date } }) => {
    if (data.issuedQuestionIds) attempt.issuedQuestionIds.push(data.issuedQuestionIds.push);
    if (data.answers) attempt.answers = data.answers;
    if (data.completedAt) attempt.completedAt = data.completedAt;
    return attempt;
  });
});
describe("server-issued adaptive attempt", () => {
  it("persists the issued question and repeats it on a lost response without revealing the answer", async () => {
    const first = await nextQuizQuestion("task", "instance", "student");
    const retry = await nextQuizQuestion("task", "instance", "student", "attempt");
    expect(first).toMatchObject({ attemptId: "attempt", done: false, nextQuestion: { id: "q1" } });
    expect(retry).toEqual(first); expect(attempt.issuedQuestionIds).toEqual(["q1"]);
    expect(JSON.stringify(first)).not.toContain("correctOptionIds");
  });
  it("rejects checking a question that was never issued, even in the same bank", async () => {
    attempt.issuedQuestionIds = ["q1"];
    await expect(checkQuizAttemptAnswer("attempt", "instance", "student", "q2", { selectedOptionIds: ["A"] })).rejects.toThrow("FORBIDDEN");
    expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
  });
  it("an initial wrong answer is immutable after the feedback reveals the right one", async () => {
    attempt.issuedQuestionIds = ["q1"];
    expect(await checkQuizAttemptAnswer("attempt", "instance", "student", "q1", { selectedOptionIds: ["B"] })).toMatchObject({ correct: false });
    expect(await checkQuizAttemptAnswer("attempt", "instance", "student", "q1", { selectedOptionIds: ["A"] })).toMatchObject({ correct: false });
    expect(attempt.answers).toHaveLength(1); expect(attempt.answers[0].selectedOptionIds).toEqual(["B"]);
    const completed = await nextQuizQuestion("task", "instance", "student", "attempt");
    expect(completed).toMatchObject({ done: true, masteryReport: { correctCount: 0, totalQuestions: 1 } });
    expect(attempt.completedAt).toBeInstanceOf(Date);
  });
  it("does not accept another user's attempt or a fixed exam attempt", async () => {
    attempt.issuedQuestionIds = ["q1"];
    await expect(checkQuizAttemptAnswer("attempt", "instance", "other", "q1", { selectedOptionIds: ["A"] })).rejects.toThrow("FORBIDDEN");
    attempt.taskSnapshot.quizConfig.mode = "fixed";
    await expect(checkQuizAttemptAnswer("attempt", "instance", "student", "q1", { selectedOptionIds: ["A"] })).rejects.toThrow("MODE_NOT_ADAPTIVE");
  });
});
