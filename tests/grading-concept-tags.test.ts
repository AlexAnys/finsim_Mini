import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    submission: { findUnique: vi.fn(), update: vi.fn() },
    simulationSubmission: { update: vi.fn() },
    quizSubmission: { update: vi.fn() },
    subjectiveSubmission: { update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        submission: {
          update: async (args: { where: { id: string } }) => ({
            id: args.where.id,
            taskType: txTaskType,
          }),
        },
        simulationSubmission: { update: vi.fn() },
        quizSubmission: { update: vi.fn() },
        subjectiveSubmission: { update: vi.fn() },
      };
      lastTx = tx;
      return fn(tx);
    }),
  },
}));

let txTaskType: "simulation" | "quiz" | "subjective" = "simulation";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastTx: any = null;

import { updateSubmissionGrade } from "@/lib/services/submission.service";

beforeEach(() => {
  vi.clearAllMocks();
  lastTx = null;
});

describe("updateSubmissionGrade — conceptTags persistence (PR-5C)", () => {
  it("writes conceptTags to SimulationSubmission when taskType=simulation", async () => {
    txTaskType = "simulation";
    await updateSubmissionGrade("sub1", {
      status: "graded",
      score: 85,
      maxScore: 100,
      evaluation: { totalScore: 85, feedback: "good" },
      conceptTags: ["CAPM", "资产配置", "风险偏好"],
    });
    expect(lastTx.simulationSubmission.update).toHaveBeenCalledWith({
      where: { submissionId: "sub1" },
      data: expect.objectContaining({
        conceptTags: ["CAPM", "资产配置", "风险偏好"],
      }),
    });
    expect(lastTx.quizSubmission.update).not.toHaveBeenCalled();
    expect(lastTx.subjectiveSubmission.update).not.toHaveBeenCalled();
  });

  it("writes conceptTags to SubjectiveSubmission when taskType=subjective", async () => {
    txTaskType = "subjective";
    await updateSubmissionGrade("sub2", {
      status: "graded",
      score: 70,
      maxScore: 100,
      evaluation: { totalScore: 70, feedback: "ok" },
      conceptTags: ["复利", "通胀"],
    });
    expect(lastTx.subjectiveSubmission.update).toHaveBeenCalledWith({
      where: { submissionId: "sub2" },
      data: expect.objectContaining({
        conceptTags: ["复利", "通胀"],
      }),
    });
  });

  it("writes empty array when conceptTags=[] (does not skip update)", async () => {
    txTaskType = "simulation";
    await updateSubmissionGrade("sub3", {
      status: "graded",
      score: 50,
      maxScore: 100,
      evaluation: { totalScore: 50, feedback: "" },
      conceptTags: [],
    });
    expect(lastTx.simulationSubmission.update).toHaveBeenCalledWith({
      where: { submissionId: "sub3" },
      data: expect.objectContaining({ conceptTags: [] }),
    });
  });

  it("does NOT touch type-specific table when neither evaluation nor conceptTags provided", async () => {
    txTaskType = "simulation";
    await updateSubmissionGrade("sub4", {
      status: "grading",
    });
    expect(lastTx.simulationSubmission.update).not.toHaveBeenCalled();
    expect(lastTx.quizSubmission.update).not.toHaveBeenCalled();
    expect(lastTx.subjectiveSubmission.update).not.toHaveBeenCalled();
  });

  it("writes evaluation only when conceptTags omitted (backward compat)", async () => {
    txTaskType = "simulation";
    await updateSubmissionGrade("sub5", {
      status: "graded",
      score: 90,
      maxScore: 100,
      evaluation: { totalScore: 90 },
    });
    const call = lastTx.simulationSubmission.update.mock.calls[0][0];
    expect(call.data.evaluation).toBeDefined();
    expect(call.data.conceptTags).toBeUndefined();
  });
});
