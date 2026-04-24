import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    chapter: { update: vi.fn(), delete: vi.fn() },
    section: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contentBlock: {
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  updateChapter,
  deleteChapter,
  updateSection,
  deleteSection,
  createContentBlock,
  updateContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
} from "@/lib/services/course.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("updateChapter", () => {
  it("rejects empty patch with EMPTY_PATCH", async () => {
    await expect(updateChapter("ch-1", {})).rejects.toThrow("EMPTY_PATCH");
    expect(prisma.chapter.update).not.toHaveBeenCalled();
  });

  it("passes title when provided", async () => {
    mk(prisma.chapter.update).mockResolvedValue({ id: "ch-1", title: "新标题" });
    const result = await updateChapter("ch-1", { title: "新标题" });
    expect(prisma.chapter.update).toHaveBeenCalledWith({
      where: { id: "ch-1" },
      data: { title: "新标题" },
    });
    expect(result.title).toBe("新标题");
  });

  it("passes order when provided", async () => {
    mk(prisma.chapter.update).mockResolvedValue({ id: "ch-1", order: 3 });
    await updateChapter("ch-1", { order: 3 });
    expect(prisma.chapter.update).toHaveBeenCalledWith({
      where: { id: "ch-1" },
      data: { order: 3 },
    });
  });

  it("passes both title and order when provided", async () => {
    mk(prisma.chapter.update).mockResolvedValue({});
    await updateChapter("ch-1", { title: "x", order: 2 });
    expect(prisma.chapter.update).toHaveBeenCalledWith({
      where: { id: "ch-1" },
      data: { title: "x", order: 2 },
    });
  });
});

describe("deleteChapter", () => {
  it("calls prisma.chapter.delete with correct id", async () => {
    mk(prisma.chapter.delete).mockResolvedValue({ id: "ch-1" });
    await deleteChapter("ch-1");
    expect(prisma.chapter.delete).toHaveBeenCalledWith({ where: { id: "ch-1" } });
  });
});

describe("updateSection", () => {
  it("rejects empty patch with EMPTY_PATCH", async () => {
    await expect(updateSection("sec-1", {})).rejects.toThrow("EMPTY_PATCH");
  });

  it("passes title correctly", async () => {
    mk(prisma.section.update).mockResolvedValue({});
    await updateSection("sec-1", { title: "新小节" });
    expect(prisma.section.update).toHaveBeenCalledWith({
      where: { id: "sec-1" },
      data: { title: "新小节" },
    });
  });
});

describe("deleteSection", () => {
  it("calls prisma.section.delete with correct id", async () => {
    mk(prisma.section.delete).mockResolvedValue({ id: "sec-1" });
    await deleteSection("sec-1");
    expect(prisma.section.delete).toHaveBeenCalledWith({ where: { id: "sec-1" } });
  });
});

describe("createContentBlock — parent validation", () => {
  it("throws SECTION_NOT_FOUND when section missing", async () => {
    mk(prisma.section.findUnique).mockResolvedValue(null);
    await expect(
      createContentBlock({
        courseId: "c-1",
        chapterId: "ch-1",
        sectionId: "sec-missing",
        slot: "in",
        blockType: "markdown",
      })
    ).rejects.toThrow("SECTION_NOT_FOUND");
  });

  it("throws SECTION_PARENT_MISMATCH when section.courseId differs", async () => {
    mk(prisma.section.findUnique).mockResolvedValue({
      courseId: "c-other",
      chapterId: "ch-1",
    });
    await expect(
      createContentBlock({
        courseId: "c-1",
        chapterId: "ch-1",
        sectionId: "sec-1",
        slot: "in",
        blockType: "markdown",
      })
    ).rejects.toThrow("SECTION_PARENT_MISMATCH");
  });

  it("throws SECTION_PARENT_MISMATCH when section.chapterId differs", async () => {
    mk(prisma.section.findUnique).mockResolvedValue({
      courseId: "c-1",
      chapterId: "ch-other",
    });
    await expect(
      createContentBlock({
        courseId: "c-1",
        chapterId: "ch-1",
        sectionId: "sec-1",
        slot: "in",
        blockType: "markdown",
      })
    ).rejects.toThrow("SECTION_PARENT_MISMATCH");
  });

  it("creates block with next order when no siblings exist", async () => {
    mk(prisma.section.findUnique).mockResolvedValue({
      courseId: "c-1",
      chapterId: "ch-1",
    });
    mk(prisma.contentBlock.aggregate).mockResolvedValue({ _max: { order: null } });
    mk(prisma.contentBlock.create).mockResolvedValue({ id: "b-new", order: 0 });

    await createContentBlock({
      courseId: "c-1",
      chapterId: "ch-1",
      sectionId: "sec-1",
      slot: "pre",
      blockType: "markdown",
      payload: { content: "hello" },
    });
    expect(prisma.contentBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order: 0, // (null ?? -1) + 1 = 0
          sectionId: "sec-1",
          slot: "pre",
          blockType: "markdown",
          data: { content: "hello" },
        }),
      })
    );
  });

  it("appends after existing max order", async () => {
    mk(prisma.section.findUnique).mockResolvedValue({
      courseId: "c-1",
      chapterId: "ch-1",
    });
    mk(prisma.contentBlock.aggregate).mockResolvedValue({ _max: { order: 5 } });
    mk(prisma.contentBlock.create).mockResolvedValue({ id: "b-new", order: 6 });

    await createContentBlock({
      courseId: "c-1",
      chapterId: "ch-1",
      sectionId: "sec-1",
      slot: "in",
      blockType: "resource",
    });
    expect(prisma.contentBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 6 }),
      })
    );
  });
});

describe("updateContentBlock", () => {
  it("rejects empty patch with EMPTY_PATCH", async () => {
    await expect(updateContentBlock("b-1", {})).rejects.toThrow("EMPTY_PATCH");
  });

  it("passes payload to data field", async () => {
    mk(prisma.contentBlock.update).mockResolvedValue({});
    await updateContentBlock("b-1", { payload: { foo: "bar" } });
    expect(prisma.contentBlock.update).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { data: { foo: "bar" } },
    });
  });

  it("passes order alone", async () => {
    mk(prisma.contentBlock.update).mockResolvedValue({});
    await updateContentBlock("b-1", { order: 7 });
    expect(prisma.contentBlock.update).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { order: 7 },
    });
  });
});

describe("deleteContentBlock", () => {
  it("calls prisma.contentBlock.delete with correct id", async () => {
    mk(prisma.contentBlock.delete).mockResolvedValue({ id: "b-1" });
    await deleteContentBlock("b-1");
    expect(prisma.contentBlock.delete).toHaveBeenCalledWith({
      where: { id: "b-1" },
    });
  });
});

describe("reorderContentBlocks", () => {
  it("returns empty array for empty input (no transaction)", async () => {
    const result = await reorderContentBlocks([]);
    expect(result).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("wraps updates in a transaction", async () => {
    mk(prisma.contentBlock.update).mockImplementation((args) => args);
    mk(prisma.$transaction).mockImplementation(async (arg: unknown) => arg);

    const items = [
      { id: "b-1", order: 2 },
      { id: "b-2", order: 0 },
      { id: "b-3", order: 1 },
    ];
    const result = await reorderContentBlocks(items);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.contentBlock.update).toHaveBeenCalledTimes(3);
    expect(prisma.contentBlock.update).toHaveBeenNthCalledWith(1, {
      where: { id: "b-1" },
      data: { order: 2 },
    });
    expect(prisma.contentBlock.update).toHaveBeenNthCalledWith(2, {
      where: { id: "b-2" },
      data: { order: 0 },
    });
    expect(prisma.contentBlock.update).toHaveBeenNthCalledWith(3, {
      where: { id: "b-3" },
      data: { order: 1 },
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
