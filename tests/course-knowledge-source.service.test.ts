import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    chapter: { findUnique: vi.fn() },
    section: { findUnique: vi.fn() },
    courseKnowledgeSource: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import {
  assertKnowledgeSourceScope,
  getKnowledgeSourcesForStudyBuddy,
  getKnowledgeSourcesForDraft,
  isReadableExtractedText,
} from "@/lib/services/course-knowledge-source.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertKnowledgeSourceScope", () => {
  it("requires chapter and section to belong to the selected course and hierarchy", async () => {
    mk(prisma.chapter.findUnique).mockResolvedValue({ courseId: "course-1" });
    mk(prisma.section.findUnique).mockResolvedValue({
      courseId: "course-1",
      chapterId: "chapter-1",
    });

    await expect(
      assertKnowledgeSourceScope({
        courseId: "course-1",
        chapterId: "chapter-1",
        sectionId: "section-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects cross-course chapter scope", async () => {
    mk(prisma.chapter.findUnique).mockResolvedValue({ courseId: "course-2" });

    await expect(
      assertKnowledgeSourceScope({ courseId: "course-1", chapterId: "chapter-1" }),
    ).rejects.toThrow("CHAPTER_COURSE_MISMATCH");
  });

  it("rejects section that is not under the selected chapter", async () => {
    mk(prisma.chapter.findUnique).mockResolvedValue({ courseId: "course-1" });
    mk(prisma.section.findUnique).mockResolvedValue({
      courseId: "course-1",
      chapterId: "chapter-2",
    });

    await expect(
      assertKnowledgeSourceScope({
        courseId: "course-1",
        chapterId: "chapter-1",
        sectionId: "section-1",
      }),
    ).rejects.toThrow("SECTION_PARENT_MISMATCH");
  });
});

describe("getKnowledgeSourcesForDraft", () => {
  it("returns ready sources scoped to the course for AI draft prompts", async () => {
    mk(prisma.courseKnowledgeSource.findMany).mockResolvedValue([
      {
        id: "source-1",
        fileName: "chapter.pdf",
        summary: "现金流教学素材",
        conceptTags: ["现金流"],
        extractedText: "现金流的定义与例题",
      },
    ]);

    await expect(
      getKnowledgeSourcesForDraft({
        courseId: "course-1",
        sourceIds: ["source-1"],
      }),
    ).resolves.toEqual([
      {
        id: "source-1",
        fileName: "chapter.pdf",
        summary: "现金流教学素材",
        conceptTags: ["现金流"],
        text: "现金流的定义与例题",
      },
    ]);
  });

  it("rejects missing, failed, or cross-course selected sources", async () => {
    mk(prisma.courseKnowledgeSource.findMany).mockResolvedValue([]);

    await expect(
      getKnowledgeSourcesForDraft({
        courseId: "course-1",
        sourceIds: ["source-1"],
      }),
    ).rejects.toThrow("KNOWLEDGE_SOURCE_NOT_FOUND");
  });
});

describe("getKnowledgeSourcesForStudyBuddy", () => {
  it("loads ready course, chapter, and section context sources for a task scope", async () => {
    mk(prisma.courseKnowledgeSource.findMany).mockResolvedValue([
      {
        id: "course-source",
        chapterId: null,
        sectionId: null,
        taskId: null,
        taskInstanceId: null,
        fileName: "course.pdf",
        summary: "课程大纲",
        conceptTags: ["理财规划"],
        extractedText: "整门课程的学习目标和术语说明",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "section-source",
        chapterId: "chapter-1",
        sectionId: "section-1",
        taskId: null,
        taskInstanceId: null,
        fileName: "section.pdf",
        summary: "小节教案",
        conceptTags: ["风险偏好"],
        extractedText: "风险偏好测评和客户沟通案例",
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    const sources = await getKnowledgeSourcesForStudyBuddy({
      courseId: "course-1",
      chapterId: "chapter-1",
      sectionId: "section-1",
    });

    expect(prisma.courseKnowledgeSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId: "course-1",
          status: expect.objectContaining({
            in: expect.arrayContaining(["ready", "ai_summary_failed"]),
          }),
          OR: expect.arrayContaining([
            { chapterId: null, sectionId: null, taskId: null, taskInstanceId: null },
            { chapterId: "chapter-1", sectionId: null, taskId: null, taskInstanceId: null },
            { sectionId: "section-1", taskId: null, taskInstanceId: null },
          ]),
        }),
      }),
    );
    expect(sources).toHaveLength(2);
    expect(sources[0].scopeLevel).toBe("section");
    expect(sources[0].scopeLabel).toBe("小节");
    expect(sources[1].excerpt).toContain("整门课程");
  });

  it("returns no sources when the post is not course scoped", async () => {
    await expect(getKnowledgeSourcesForStudyBuddy({ courseId: null })).resolves.toEqual([]);
    expect(prisma.courseKnowledgeSource.findMany).not.toHaveBeenCalled();
  });
});

describe("isReadableExtractedText", () => {
  it("accepts normal course material text", () => {
    expect(
      isReadableExtractedText(
        "个人理财课程知识点：现金流、风险收益、预算管理。学生需要理解家庭资产负债表，并能够完成基础案例分析。",
      ),
    ).toBe(true);
  });

  it("rejects raw PDF object streams from failed extraction fallback", () => {
    expect(
      isReadableExtractedText(
        "%PDF-1.4 1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj xref trailer stream /Filter /FlateDecode endstream",
      ),
    ).toBe(false);
  });
});
