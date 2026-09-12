import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: { submission: { findUnique: vi.fn() }, subjectiveSubmission: { update: vi.fn() } } }));
vi.mock("@/lib/services/submission.service", () => ({ updateSubmissionGrade: vi.fn(async () => ({})) }));
vi.mock("@/lib/services/audit.service", () => ({ logAuditEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/services/ai.service", () => ({ aiGenerateJSON: vi.fn() }));
vi.mock("@/lib/services/storage.service", () => ({ readStoredFile: vi.fn() }));
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { readStoredFile } from "@/lib/services/storage.service";
import { updateSubmissionGrade } from "@/lib/services/submission.service";
import { gradeSubmission } from "@/lib/services/grading.service";
import { docxBuffer, financialText, spreadsheetBuffer } from "./_fixtures/document-buffers";

function submission(fileName: string) {
  return { id: "sub", studentId: "student", taskId: "task", status: "submitted", taskType: "subjective",
    task: { taskName: "报告", taskType: "subjective", subjectiveConfig: { prompt: "分析资产", strictnessLevel: "MODERATE" }, scoringCriteria: [{ id: "r1", name: "完整性", maxPoints: 10 }] },
    taskInstance: { createdBy: "teacher", releaseMode: "auto", autoReleaseAt: null },
    subjectiveSubmission: { textAnswer: "详见附件", attachments: [{ filePath: `test/${fileName}`, fileName }] },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(aiGenerateJSON).mockResolvedValue({ totalScore: 8, feedback: "按所给合成结果返回", rubricBreakdown: [{ criterionId: "r1", score: 8, maxScore: 10, comment: "完整" }] } as never);
});

describe("real attachment parsers in the grading service", () => {
  it.each(["docx", "xlsx", "xls", "csv"] as const)("passes actual %s evidence to the grading prompt and stores the same source text", async extension => {
    const buffer = extension === "docx" ? await docxBuffer() : spreadsheetBuffer(extension === "xls" ? "biff8" : extension);
    vi.mocked(readStoredFile).mockResolvedValue(buffer);
    vi.mocked(prisma.submission.findUnique).mockResolvedValue(submission(`配置.${extension}`) as never);
    await gradeSubmission("sub");
    expect(vi.mocked(aiGenerateJSON).mock.calls[0][3]).toContain(financialText);
    expect(prisma.subjectiveSubmission.update).toHaveBeenCalledWith({ where: { submissionId: "sub" }, data: { extractedText: expect.stringContaining(financialText) } });
    expect(updateSubmissionGrade).toHaveBeenCalledWith("sub", expect.objectContaining({ status: "graded", score: 8 }));
  });

  it.each(["docx", "xlsx"])("does not invoke AI or save an official grade for corrupt %s ZIP input", async extension => {
    vi.mocked(readStoredFile).mockResolvedValue(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
    vi.mocked(prisma.submission.findUnique).mockResolvedValue(submission(`损坏.${extension}`) as never);
    await expect(gradeSubmission("sub")).rejects.toThrow("ATTACHMENT_EXTRACTION_INCOMPLETE");
    expect(aiGenerateJSON).not.toHaveBeenCalled();
    expect(prisma.subjectiveSubmission.update).not.toHaveBeenCalled();
    expect(vi.mocked(updateSubmissionGrade).mock.calls.some(([, data]) => data.status === "graded")).toBe(false);
    expect(updateSubmissionGrade).toHaveBeenCalledWith("sub", expect.objectContaining({ status: "failed" }));
  });
});
