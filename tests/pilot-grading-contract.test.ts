import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: { submission: { findUnique: vi.fn() }, subjectiveSubmission: { update: vi.fn() } } }));
vi.mock("@/lib/services/submission.service", () => ({ updateSubmissionGrade: vi.fn(async () => ({})) }));
vi.mock("@/lib/services/audit.service", () => ({ logAuditEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/services/ai.service", () => ({ aiGenerateJSON: vi.fn(), getLastAiRunMetadata: vi.fn(async () => null) }));
vi.mock("@/lib/services/document-ingestion.service", () => ({ extractDocumentText: vi.fn() }));
vi.mock("@/lib/services/storage.service", () => ({ readStoredFile: vi.fn(async () => Buffer.from("document")) }));
import { prisma } from "@/lib/db/prisma";
import { updateSubmissionGrade } from "@/lib/services/submission.service";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";
import { gradeSubmission } from "@/lib/services/grading.service";
import { studentTaskView } from "@/lib/utils/student-task-view";
import { createRubricEvaluationSchema } from "@/lib/services/ai-grade-validation";
const q = (id: string) => ({ id, type: "single_choice", points: 1, prompt: id, correctOptionIds: ["A"] });
const task = (ids: string[]) => ({ taskName: "quiz", taskType: "quiz", quizQuestions: ids.map(q), quizConfig: { mode: "fixed" }, scoringCriteria: [] });
const submission = (ids: string[]) => ({ id: "sub", status: "submitted", studentId: "student", taskType: "quiz", taskId: "task", task: task(ids), quizSubmission: { answers: [{ questionId: "q1", selectedOptionIds: ["A"] }] }, taskInstance: { createdBy: "teacher", releaseMode: "auto", autoReleaseAt: null } });
const records = () => vi.mocked(updateSubmissionGrade).mock.calls.map(call => call[1]);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(aiGenerateJSON).mockResolvedValue({ conceptTags: [] } as never); });
describe("pilot score and evidence contract", () => {
  it("student payload strips teacher material in nested snapshots even with a toJSON string", () => {
    const value = { taskSnapshot: { toJSON: "untrusted", quizQuestions: [{ prompt: "题面", correctOptionIds: ["A"], correctAnswer: "secret", explanation: "secret" }] }, task: { subjectiveConfig: { referenceAnswer: "secret" } } };
    const output = studentTaskView(value);
    expect(JSON.stringify(output)).not.toContain("secret");
    expect(JSON.stringify(output)).not.toContain("correctOptionIds");
    expect(output.taskSnapshot.quizQuestions[0].prompt).toBe("题面");
  });
  it("grades using the submission's version after live template IDs change", async () => {
    vi.mocked(prisma.submission.findUnique).mockResolvedValue({ ...submission(["new-q1"]), taskSnapshot: task(["q1"]) } as never);
    await gradeSubmission("sub");
    expect(records().find(r => r.status === "graded")).toMatchObject({ score: 1, maxScore: 1 });
  });
  it("adaptive final grade uses the server-frozen issued set, not the full bank", async () => {
    const row = submission(["q1", "q2", "q3", "q4", "q5"]);
    vi.mocked(prisma.submission.findUnique).mockResolvedValue({ ...row, taskSnapshot: task(["q1", "q2"]), quizSubmission: { answers: ["q1", "q2"].map(questionId => ({ questionId, selectedOptionIds: ["A"] })) } } as never);
    await gradeSubmission("sub");
    expect(records().find(r => r.status === "graded")).toMatchObject({ score: 2, maxScore: 2 });
  });
  it("short-answer provider failure remains failed and unreleased, never an official zero", async () => {
    const row = submission(["q1"]); row.task.quizQuestions[0].type = "short_answer";
    vi.mocked(prisma.submission.findUnique).mockResolvedValue(row as never);
    vi.mocked(aiGenerateJSON).mockRejectedValue(new Error("AI_TIMEOUT"));
    await expect(gradeSubmission("sub")).rejects.toThrow("QUIZ_GRADING_INCOMPLETE");
    expect(records().some(r => r.status === "graded")).toBe(false);
    expect(records().find(r => r.status === "failed")).toBeDefined();
  });
  it("missing, duplicate, wrong-max, or negative rubric items are rejected", () => {
    const schema = createRubricEvaluationSchema([{ id: "r1", maxPoints: 10 }, { id: "r2", maxPoints: 10 }]);
    const item = { criterionId: "r1", score: 5, maxScore: 10, comment: "证据" };
    for (const rubricBreakdown of [[item], [item, item], [item, { ...item, criterionId: "r2", maxScore: 20 }], [item, { ...item, criterionId: "r2", score: -1 }]]) expect(schema.safeParse({ totalScore: 10, feedback: "评价", rubricBreakdown }).success).toBe(false);
  });
  it("includes extracted attachment evidence in the actual AI prompt", async () => {
    vi.mocked(prisma.submission.findUnique).mockResolvedValue({ ...submission([]), taskType: "subjective", task: { taskName: "报告", taskType: "subjective", subjectiveConfig: { prompt: "分析资产", strictnessLevel: "MODERATE" }, scoringCriteria: [{ id: "r1", name: "完整性", maxPoints: 10 }] }, subjectiveSubmission: { textAnswer: "详见附件", attachments: [{ filePath: "u.pdf", fileName: "报告.pdf", contentType: "application/pdf" }] } } as never);
    vi.mocked(extractDocumentText).mockResolvedValue({ status: "ready", kind: "pdf", text: "附件中的完整分析：分散资产并保留现金。", files: [], warnings: [] });
    vi.mocked(aiGenerateJSON).mockResolvedValue({ totalScore: 8, feedback: "完成分析", rubricBreakdown: [{ criterionId: "r1", score: 8, maxScore: 10, comment: "完整" }] } as never);
    await gradeSubmission("sub");
    expect(vi.mocked(aiGenerateJSON).mock.calls[0][3]).toContain("附件中的完整分析");
    expect(records().find(r => r.status === "graded")).toMatchObject({ score: 8 });
  });
  it("does not overwrite manually finished or deleted submissions", async () => {
    for (const row of [{ ...submission([]), status: "graded" }, { ...submission([]), deletedAt: new Date() }]) {
      vi.mocked(prisma.submission.findUnique).mockResolvedValue(row as never); await gradeSubmission("sub");
    }
    expect(updateSubmissionGrade).not.toHaveBeenCalled();
  });
});
