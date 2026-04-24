import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
    chapter: { findUnique: vi.fn() },
    section: { findUnique: vi.fn() },
    contentBlock: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  assertChapterWritable,
  assertSectionWritable,
  assertContentBlockWritable,
} from "@/lib/auth/resource-access";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

/**
 * PR-4D1 write-side guards for Chapter / Section / ContentBlock mutations.
 *
 * Each guard resolves the resource's courseId and delegates to
 * assertCourseAccess. admin is a hard bypass (no DB read). Students are
 * rejected outright even if somehow they had course access elsewhere.
 */

describe("assertChapterWritable", () => {
  it("admin: bypass (no DB read)", async () => {
    await expect(
      assertChapterWritable("ch-1", { id: "admin-1", role: "admin" })
    ).resolves.toBeUndefined();
    expect(prisma.chapter.findUnique).not.toHaveBeenCalled();
  });

  it("student: FORBIDDEN (no DB read)", async () => {
    await expect(
      assertChapterWritable("ch-1", { id: "s1", role: "student", classId: "cls-1" })
    ).rejects.toThrow("FORBIDDEN");
    expect(prisma.chapter.findUnique).not.toHaveBeenCalled();
  });

  it("missing chapter: CHAPTER_NOT_FOUND", async () => {
    mk(prisma.chapter.findUnique).mockResolvedValue(null);
    await expect(
      assertChapterWritable("ch-missing", { id: "t1", role: "teacher" })
    ).rejects.toThrow("CHAPTER_NOT_FOUND");
  });

  it("teacher owner of parent course: permitted", async () => {
    mk(prisma.chapter.findUnique).mockResolvedValue({
      id: "ch-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-owner",
    });
    await expect(
      assertChapterWritable("ch-1", { id: "t-owner", role: "teacher" })
    ).resolves.toBeUndefined();
  });

  it("teacher non-owner non-collab: FORBIDDEN", async () => {
    mk(prisma.chapter.findUnique).mockResolvedValue({
      id: "ch-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertChapterWritable("ch-1", { id: "t-stranger", role: "teacher" })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher collaborator: permitted", async () => {
    mk(prisma.chapter.findUnique).mockResolvedValue({
      id: "ch-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({
      courseId: "c-1",
      teacherId: "t-collab",
    });
    await expect(
      assertChapterWritable("ch-1", { id: "t-collab", role: "teacher" })
    ).resolves.toBeUndefined();
  });
});

describe("assertSectionWritable", () => {
  it("admin: bypass", async () => {
    await expect(
      assertSectionWritable("sec-1", { id: "admin-1", role: "admin" })
    ).resolves.toBeUndefined();
    expect(prisma.section.findUnique).not.toHaveBeenCalled();
  });

  it("student: FORBIDDEN", async () => {
    await expect(
      assertSectionWritable("sec-1", { id: "s1", role: "student" })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("missing section: SECTION_NOT_FOUND", async () => {
    mk(prisma.section.findUnique).mockResolvedValue(null);
    await expect(
      assertSectionWritable("sec-missing", { id: "t1", role: "teacher" })
    ).rejects.toThrow("SECTION_NOT_FOUND");
  });

  it("teacher owner: permitted", async () => {
    mk(prisma.section.findUnique).mockResolvedValue({
      id: "sec-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-owner",
    });
    await expect(
      assertSectionWritable("sec-1", { id: "t-owner", role: "teacher" })
    ).resolves.toBeUndefined();
  });

  it("teacher stranger: FORBIDDEN", async () => {
    mk(prisma.section.findUnique).mockResolvedValue({
      id: "sec-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertSectionWritable("sec-1", { id: "t-stranger", role: "teacher" })
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("assertContentBlockWritable", () => {
  it("admin: bypass", async () => {
    await expect(
      assertContentBlockWritable("b-1", { id: "admin-1", role: "admin" })
    ).resolves.toBeUndefined();
    expect(prisma.contentBlock.findUnique).not.toHaveBeenCalled();
  });

  it("student: FORBIDDEN", async () => {
    await expect(
      assertContentBlockWritable("b-1", { id: "s1", role: "student" })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("missing block: BLOCK_NOT_FOUND", async () => {
    mk(prisma.contentBlock.findUnique).mockResolvedValue(null);
    await expect(
      assertContentBlockWritable("b-missing", { id: "t1", role: "teacher" })
    ).rejects.toThrow("BLOCK_NOT_FOUND");
  });

  it("teacher owner of parent course: permitted", async () => {
    mk(prisma.contentBlock.findUnique).mockResolvedValue({
      id: "b-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-owner",
    });
    await expect(
      assertContentBlockWritable("b-1", { id: "t-owner", role: "teacher" })
    ).resolves.toBeUndefined();
  });

  it("teacher stranger: FORBIDDEN (can't tamper cross-course)", async () => {
    mk(prisma.contentBlock.findUnique).mockResolvedValue({
      id: "b-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertContentBlockWritable("b-1", { id: "t-stranger", role: "teacher" })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher collaborator: permitted", async () => {
    mk(prisma.contentBlock.findUnique).mockResolvedValue({
      id: "b-1",
      courseId: "c-1",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      createdBy: "t-other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({
      courseId: "c-1",
      teacherId: "t-collab",
    });
    await expect(
      assertContentBlockWritable("b-1", { id: "t-collab", role: "teacher" })
    ).resolves.toBeUndefined();
  });
});
