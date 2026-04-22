import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findMany: vi.fn(), update: vi.fn() },
    courseTeacher: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  assertCourseAccessBulk,
  batchUpdateSemesterStart,
} from "@/lib/services/course.service";

const mFindMany = () =>
  prisma.course.findMany as unknown as ReturnType<typeof vi.fn>;
const mTeacherFindMany = () =>
  prisma.courseTeacher.findMany as unknown as ReturnType<typeof vi.fn>;
const mTx = () => prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

describe("assertCourseAccessBulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin passes without queries", async () => {
    await expect(
      assertCourseAccessBulk(["c-1", "c-2"], "u-admin", "admin")
    ).resolves.toBeUndefined();
    expect(mFindMany()).not.toHaveBeenCalled();
  });

  it("empty list passes", async () => {
    await expect(
      assertCourseAccessBulk([], "u-1", "teacher")
    ).resolves.toBeUndefined();
    expect(mFindMany()).not.toHaveBeenCalled();
  });

  it("throws COURSE_NOT_FOUND when some ids are missing", async () => {
    mFindMany().mockResolvedValue([{ id: "c-1", createdBy: "u-1" }]);
    await expect(
      assertCourseAccessBulk(["c-1", "c-2"], "u-1", "teacher")
    ).rejects.toThrow("COURSE_NOT_FOUND");
  });

  it("passes when user is creator of all courses", async () => {
    mFindMany().mockResolvedValue([
      { id: "c-1", createdBy: "u-1" },
      { id: "c-2", createdBy: "u-1" },
    ]);
    await expect(
      assertCourseAccessBulk(["c-1", "c-2"], "u-1", "teacher")
    ).resolves.toBeUndefined();
    // Should not need courseTeacher lookup when everything is owned
    expect(mTeacherFindMany()).not.toHaveBeenCalled();
  });

  it("passes when non-owner is a CourseTeacher collaborator", async () => {
    mFindMany().mockResolvedValue([
      { id: "c-1", createdBy: "u-owner" },
      { id: "c-2", createdBy: "u-1" },
    ]);
    mTeacherFindMany().mockResolvedValue([{ courseId: "c-1" }]);
    await expect(
      assertCourseAccessBulk(["c-1", "c-2"], "u-1", "teacher")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when non-owner is not a collaborator on some course", async () => {
    mFindMany().mockResolvedValue([
      { id: "c-1", createdBy: "u-owner" },
      { id: "c-2", createdBy: "u-other-owner" },
    ]);
    mTeacherFindMany().mockResolvedValue([{ courseId: "c-1" }]);
    await expect(
      assertCourseAccessBulk(["c-1", "c-2"], "u-1", "teacher")
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("batchUpdateSemesterStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws EMPTY_COURSE_LIST on empty ids", async () => {
    await expect(
      batchUpdateSemesterStart([], new Date(), "u-1", "teacher")
    ).rejects.toThrow("EMPTY_COURSE_LIST");
  });

  it("runs a prisma $transaction of update ops when access is granted", async () => {
    mFindMany().mockResolvedValue([{ id: "c-1", createdBy: "u-1" }]);
    mTx().mockResolvedValue([{ id: "c-1" }]);
    // Stub prisma.course.update to be a function so the service can build the op call
    (prisma.course.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue("update-op");

    const d = new Date("2026-02-17T00:00:00.000Z");
    const result = await batchUpdateSemesterStart(["c-1"], d, "u-1", "teacher");

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { semesterStartDate: d },
    });
    expect(mTx()).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: "c-1" }]);
  });

  it("throws FORBIDDEN before any update when a target course is inaccessible", async () => {
    mFindMany().mockResolvedValue([
      { id: "c-1", createdBy: "u-other" },
    ]);
    mTeacherFindMany().mockResolvedValue([]);
    await expect(
      batchUpdateSemesterStart(["c-1"], new Date(), "u-1", "teacher")
    ).rejects.toThrow("FORBIDDEN");
    expect(mTx()).not.toHaveBeenCalled();
  });
});
