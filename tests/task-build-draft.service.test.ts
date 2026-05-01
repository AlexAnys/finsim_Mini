import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    chapter: { findUnique: vi.fn() },
    section: { findUnique: vi.fn() },
    taskBuildDraft: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createTaskBuildDraft,
  listTaskBuildDrafts,
} from "@/lib/services/task-build-draft.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("task-build-draft.service", () => {
  it("creates an incomplete draft scoped to course/chapter/section/slot", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({ id: "course-1" });
    mk(prisma.chapter.findUnique).mockResolvedValue({
      id: "chapter-1",
      courseId: "course-1",
    });
    mk(prisma.section.findUnique).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      chapterId: "chapter-1",
    });
    mk(prisma.taskBuildDraft.create).mockResolvedValue({ id: "draft-1" });

    await expect(
      createTaskBuildDraft("teacher-1", {
        courseId: "course-1",
        chapterId: "chapter-1",
        sectionId: "section-1",
        slot: "pre",
        taskType: "quiz",
        title: "",
        sourceIds: ["00000000-0000-0000-0000-000000000001"],
        missingFields: ["题目"],
        draftPayload: { form: { taskType: "quiz" } },
      }),
    ).resolves.toEqual({ id: "draft-1" });

    expect(prisma.taskBuildDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: "course-1",
          chapterId: "chapter-1",
          sectionId: "section-1",
          slot: "pre",
          taskType: "quiz",
          title: "未命名任务草稿",
          missingFields: ["题目"],
          createdBy: "teacher-1",
        }),
      }),
    );
  });

  it("rejects a section outside the selected chapter", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({ id: "course-1" });
    mk(prisma.chapter.findUnique).mockResolvedValue({
      id: "chapter-1",
      courseId: "course-1",
    });
    mk(prisma.section.findUnique).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      chapterId: "chapter-2",
    });

    await expect(
      createTaskBuildDraft("teacher-1", {
        courseId: "course-1",
        chapterId: "chapter-1",
        sectionId: "section-1",
        taskType: "simulation",
      }),
    ).rejects.toThrow("SECTION_PARENT_MISMATCH");
  });

  it("lists drafts newest first for a course", async () => {
    mk(prisma.taskBuildDraft.findMany).mockResolvedValue([{ id: "draft-1" }]);

    await expect(listTaskBuildDrafts("course-1")).resolves.toEqual([
      { id: "draft-1" },
    ]);
    expect(prisma.taskBuildDraft.findMany).toHaveBeenCalledWith({
      where: { courseId: "course-1" },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  });
});
