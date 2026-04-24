import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { assertCourseAccess } from "@/lib/auth/course-access";

describe("assertCourseAccess (shared guard)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin bypasses all checks without a DB query", async () => {
    await assertCourseAccess("course-1", "admin-1", "admin");
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
    expect(prisma.courseTeacher.findUnique).not.toHaveBeenCalled();
  });

  it("owner (course.createdBy) passes without CourseTeacher lookup", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });

    await assertCourseAccess("course-1", "teacher-owner", "teacher");
    expect(prisma.courseTeacher.findUnique).not.toHaveBeenCalled();
  });

  it("collaborating teacher (in CourseTeacher) passes", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });
    (prisma.courseTeacher.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: "course-1",
      teacherId: "teacher-collab",
    });

    await expect(
      assertCourseAccess("course-1", "teacher-collab", "teacher")
    ).resolves.toBeUndefined();
  });

  it("non-owner, non-collaborator teacher throws FORBIDDEN", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });
    (prisma.courseTeacher.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      assertCourseAccess("course-1", "teacher-other", "teacher")
    ).rejects.toThrow("FORBIDDEN");
  });

  it("non-existent course throws COURSE_NOT_FOUND", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      assertCourseAccess("course-missing", "teacher-1", "teacher")
    ).rejects.toThrow("COURSE_NOT_FOUND");
  });
});
