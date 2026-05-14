import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    courseKnowledgeSource: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/async-job.service", () => ({
  enqueueAsyncJob: vi.fn().mockResolvedValue({ id: "job-1" }),
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import { retryCourseKnowledgeSource } from "@/lib/services/course-knowledge-source.service";
import {
  isKnowledgeSourceProcessing,
  isKnowledgeSourceRetryable,
  knowledgeSourceRetryLabel,
  knowledgeSourceStatusLabel,
  knowledgeSourceProgressPercent,
} from "@/lib/utils/knowledge-source-status";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retryCourseKnowledgeSource", () => {
  it("re-enqueues an ai_summary_failed source and resets status + error", async () => {
    mk(prisma.courseKnowledgeSource.findUnique).mockResolvedValue({
      id: "src-1",
      courseId: "course-1",
      filePath: "uploads/x.pdf",
      teacherId: "teacher-1",
      status: "ai_summary_failed",
    });
    mk(prisma.courseKnowledgeSource.update).mockResolvedValue({
      id: "src-1",
      status: "uploaded",
      error: null,
    });

    const result = await retryCourseKnowledgeSource({
      id: "src-1",
      userId: "teacher-1",
      role: "teacher",
    });

    expect(prisma.courseKnowledgeSource.update).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: { status: "uploaded", error: null },
    });
    expect(enqueueAsyncJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "knowledge_source_ingest",
        entityId: "src-1",
        input: { sourceId: "src-1" },
        createdBy: "teacher-1",
      }),
    );
    expect(result.asyncJob).toEqual({ id: "job-1" });
  });

  it("re-enqueues a failed source", async () => {
    mk(prisma.courseKnowledgeSource.findUnique).mockResolvedValue({
      id: "src-1",
      courseId: "course-1",
      filePath: "uploads/x.pdf",
      teacherId: "teacher-1",
      status: "failed",
    });
    mk(prisma.courseKnowledgeSource.update).mockResolvedValue({
      id: "src-1",
      status: "uploaded",
      error: null,
    });

    await expect(
      retryCourseKnowledgeSource({
        id: "src-1",
        userId: "teacher-1",
        role: "teacher",
      }),
    ).resolves.toBeDefined();
    expect(enqueueAsyncJob).toHaveBeenCalled();
  });

  it("re-enqueues a ready source for rescan (M3b)", async () => {
    mk(prisma.courseKnowledgeSource.findUnique).mockResolvedValue({
      id: "src-1",
      courseId: "course-1",
      filePath: "uploads/x.pdf",
      teacherId: "teacher-1",
      status: "ready",
    });
    mk(prisma.courseKnowledgeSource.update).mockResolvedValue({
      id: "src-1",
      status: "uploaded",
      error: null,
    });

    await expect(
      retryCourseKnowledgeSource({
        id: "src-1",
        userId: "teacher-1",
        role: "teacher",
      }),
    ).resolves.toBeDefined();
    expect(prisma.courseKnowledgeSource.update).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: { status: "uploaded", error: null },
    });
    expect(enqueueAsyncJob).toHaveBeenCalled();
  });

  it("rejects retry when source not found", async () => {
    mk(prisma.courseKnowledgeSource.findUnique).mockResolvedValue(null);

    await expect(
      retryCourseKnowledgeSource({
        id: "missing",
        userId: "teacher-1",
        role: "teacher",
      }),
    ).rejects.toThrow("KNOWLEDGE_SOURCE_NOT_FOUND");
    expect(enqueueAsyncJob).not.toHaveBeenCalled();
  });

  it("rejects retry when filePath is missing", async () => {
    mk(prisma.courseKnowledgeSource.findUnique).mockResolvedValue({
      id: "src-1",
      courseId: "course-1",
      filePath: null,
      teacherId: "teacher-1",
      status: "ai_summary_failed",
    });

    await expect(
      retryCourseKnowledgeSource({
        id: "src-1",
        userId: "teacher-1",
        role: "teacher",
      }),
    ).rejects.toThrow("KNOWLEDGE_SOURCE_NOT_RETRYABLE");
  });
});

describe("knowledge-source-status helpers", () => {
  it("marks processing-only statuses as processing", () => {
    expect(isKnowledgeSourceProcessing("uploaded")).toBe(true);
    expect(isKnowledgeSourceProcessing("extracting")).toBe(true);
    expect(isKnowledgeSourceProcessing("processing")).toBe(true);
    expect(isKnowledgeSourceProcessing("ocr_processing")).toBe(true);
    expect(isKnowledgeSourceProcessing("ready")).toBe(false);
    expect(isKnowledgeSourceProcessing("ai_summary_failed")).toBe(false);
    expect(isKnowledgeSourceProcessing("failed")).toBe(false);
  });

  it("marks ai_summary_failed / failed / ocr_required / ready as retryable", () => {
    expect(isKnowledgeSourceRetryable("ai_summary_failed")).toBe(true);
    expect(isKnowledgeSourceRetryable("failed")).toBe(true);
    expect(isKnowledgeSourceRetryable("ocr_required")).toBe(true);
    expect(isKnowledgeSourceRetryable("ready")).toBe(true);
    expect(isKnowledgeSourceRetryable("processing")).toBe(false);
  });

  it("returns Chinese status labels", () => {
    expect(knowledgeSourceStatusLabel("ready")).toBe("可用");
    expect(knowledgeSourceStatusLabel("ai_summary_failed")).toBe("AI 解析失败");
    expect(knowledgeSourceStatusLabel("extracting")).toBe("正在抽取文本");
    expect(knowledgeSourceStatusLabel("processing")).toBe("AI 正在解析");
  });

  it("returns monotonic progress percentages along the pipeline", () => {
    const uploaded = knowledgeSourceProgressPercent("uploaded");
    const extracting = knowledgeSourceProgressPercent("extracting");
    const processing = knowledgeSourceProgressPercent("processing");
    const ready = knowledgeSourceProgressPercent("ready");
    expect(uploaded).toBeLessThan(extracting);
    expect(extracting).toBeLessThan(processing);
    expect(processing).toBeLessThan(ready);
    expect(ready).toBe(100);
  });

  it("knowledgeSourceRetryLabel returns rescan label for ready and AI-parse label for others", () => {
    expect(knowledgeSourceRetryLabel("ready")).toBe("重新解析素材");
    expect(knowledgeSourceRetryLabel("ai_summary_failed")).toBe("重新 AI 解析");
    expect(knowledgeSourceRetryLabel("failed")).toBe("重新 AI 解析");
    expect(knowledgeSourceRetryLabel("ocr_required")).toBe("重新 AI 解析");
  });
});
