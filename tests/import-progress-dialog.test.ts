import { describe, it, expect } from "vitest";
import {
  deriveStage,
  type ImportJobStatus,
} from "@/components/task-edit/import-progress-dialog";

function makeJob(partial: Partial<ImportJobStatus> = {}): ImportJobStatus {
  return {
    id: "job-1",
    status: "uploaded",
    totalQuestions: null,
    processedQuestions: null,
    error: null,
    fileName: "test.pdf",
    ...partial,
  };
}

describe("deriveStage", () => {
  it("returns uploading when no jobId yet (file in transit)", () => {
    expect(deriveStage(null, false)).toBe("uploading");
  });

  it("returns uploading when jobId exists but no status fetched yet", () => {
    expect(deriveStage(null, true)).toBe("uploading");
  });

  it("returns uploading when status is uploaded", () => {
    expect(deriveStage(makeJob({ status: "uploaded" }), true)).toBe("uploading");
  });

  it("returns analyzing when processing but totalQuestions not yet determined", () => {
    expect(
      deriveStage(makeJob({ status: "processing", totalQuestions: null }), true),
    ).toBe("analyzing");
  });

  it("returns extracting when processing and totalQuestions known", () => {
    expect(
      deriveStage(
        makeJob({ status: "processing", totalQuestions: 30, processedQuestions: 10 }),
        true,
      ),
    ).toBe("extracting");
  });

  it("returns extracting even when processedQuestions is 0 but totalQuestions is known", () => {
    expect(
      deriveStage(
        makeJob({ status: "processing", totalQuestions: 12, processedQuestions: 0 }),
        true,
      ),
    ).toBe("extracting");
  });

  it("returns completed when status is completed", () => {
    expect(
      deriveStage(
        makeJob({ status: "completed", totalQuestions: 30, processedQuestions: 30 }),
        true,
      ),
    ).toBe("completed");
  });

  it("returns failed when status is failed", () => {
    expect(
      deriveStage(makeJob({ status: "failed", error: "解析失败" }), true),
    ).toBe("failed");
  });

  it("treats failed as terminal even if totalQuestions populated", () => {
    expect(
      deriveStage(
        makeJob({ status: "failed", totalQuestions: 5, error: "中途失败" }),
        true,
      ),
    ).toBe("failed");
  });
});
