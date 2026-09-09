import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  taskInstance: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  task: { findUnique: vi.fn() }, submission: { count: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/services/task.service", () => ({ createTaskInTransaction: vi.fn(async () => ({ id: "task" })) }));
vi.mock("@/lib/services/audit.service", () => ({ logAuditEvent: vi.fn() }));
import { prisma } from "@/lib/db/prisma";
import { hasUsableRubric } from "@/lib/utils/task-publish-readiness";
import { assertTaskReadyForPublish, createPublishedTaskWithInstanceInTransaction, publishTaskInstance, createTaskInstance, updateTaskInstanceSnapshot, updateTaskInstance, reopenTaskInstance } from "@/lib/services/task-instance.service";
import { handleServiceError } from "@/lib/api-utils";
const rubric = [{ id: "r1", name: "分析质量", maxPoints: 10, order: 0 }];
const task = { id: "task", taskType: "subjective", taskName: "报告", subjectiveConfig: { prompt: "说明你的分析" }, scoringCriteria: rubric };
const instance = { id: "instance", taskId: "task", taskType: "subjective", taskSnapshot: task, task, status: "draft", createdBy: "teacher", courseId: null };
const mk = (f: unknown) => f as ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  mk(prisma.$transaction).mockImplementation(async (arg: unknown) => typeof arg === "function" ? arg(prisma) : Promise.all(arg as Promise<unknown>[]));
  mk(prisma.taskInstance.findUnique).mockResolvedValue(instance);
});
describe("publication requires executable scoring, while drafts remain editable", () => {
  it("rejects empty, blank, zero/negative, nonfinite and duplicate-ID criteria", () => {
    for (const criteria of [undefined, [], [{ name: " ", maxPoints: 10 }], [{ name: "x", maxPoints: 0 }], [{ name: "x", maxPoints: -1 }], [{ name: "x", maxPoints: Infinity }], [rubric[0], rubric[0]]]) expect(hasUsableRubric(criteria)).toBe(false);
    expect(hasUsableRubric(rubric)).toBe(true);
  });
  it("applies the rubric rule to simulation/subjective, but not question-scored quizzes", () => {
    for (const taskType of ["simulation", "subjective"]) {
      const config = { taskType, simulationConfig: { scenario: "场景" }, subjectiveConfig: { prompt: "题干" } };
      expect(() => assertTaskReadyForPublish(config)).toThrow("TASK_RUBRIC_REQUIRED");
      expect(() => assertTaskReadyForPublish({ ...config, scoringCriteria: rubric })).not.toThrow();
    }
    expect(() => assertTaskReadyForPublish({ taskType: "quiz", quizConfig: { mode: "fixed" }, quizQuestions: [{ points: 1 }], scoringCriteria: [] })).not.toThrow();
  });
  it("with-task rejects an ungradable task before creating a published instance", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({ ...task, scoringCriteria: [] });
    await expect(createPublishedTaskWithInstanceInTransaction(prisma as never, "teacher", { task: {}, instance: {} } as never)).rejects.toThrow("TASK_RUBRIC_REQUIRED");
    expect(prisma.taskInstance.create).not.toHaveBeenCalled();
  });
  it("publish rejects empty rubric and accepts the corrected task", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, task: { ...task, scoringCriteria: [] } });
    await expect(publishTaskInstance("instance", "teacher")).rejects.toThrow("TASK_RUBRIC_REQUIRED");
    expect(prisma.taskInstance.update).not.toHaveBeenCalled();
    mk(prisma.taskInstance.findUnique).mockResolvedValue(instance);
    await publishTaskInstance("instance", "teacher");
    expect(prisma.taskInstance.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "published" }) }));
  });
  it("a published snapshot cannot remove its rubric or overwrite the valid original", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, status: "published" });
    await expect(updateTaskInstanceSnapshot("instance", "teacher", { taskType: "subjective", scoringCriteria: [] })).rejects.toThrow("TASK_RUBRIC_REQUIRED");
    expect(prisma.taskInstance.update).not.toHaveBeenCalled();
  });
  it("still permits saving an incomplete draft and editing its empty rubric", async () => {
    await createTaskInstance("teacher", { taskId: "task", taskType: "subjective", title: "草稿", classId: "class", groupIds: [], dueAt: new Date().toISOString() });
    expect(prisma.taskInstance.create).toHaveBeenCalled();
    await updateTaskInstanceSnapshot("instance", "teacher", { taskType: "subjective", scoringCriteria: [] });
    expect(prisma.taskInstance.update).toHaveBeenCalled();
  });
  it("status PATCH and reopen cannot bypass readiness", async () => {
    const broken = { ...task, scoringCriteria: [] };
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, task: broken, taskSnapshot: broken });
    await expect(updateTaskInstance("instance", "teacher", { status: "published" })).rejects.toThrow("TASK_RUBRIC_REQUIRED");
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ ...instance, status: "closed", task: broken, taskSnapshot: broken });
    await expect(reopenTaskInstance("instance", "teacher")).rejects.toThrow("TASK_RUBRIC_REQUIRED");
    expect(prisma.taskInstance.update).not.toHaveBeenCalled();
  });
  it("returns a Chinese 400 explaining publish versus draft", async () => {
    const response = handleServiceError(new Error("TASK_RUBRIC_REQUIRED"));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.message).toContain("评分标准"); expect(json.error.message).toContain("保存草稿");
  });
});
