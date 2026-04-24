import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  assertCourseAccessForStudent,
  assertCourseReadable,
} from "@/lib/auth/course-access";

describe("assertCourseAccessForStudent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("empty classId → FORBIDDEN without DB lookup", async () => {
    await expect(
      assertCourseAccessForStudent("course-1", ""),
    ).rejects.toThrow("FORBIDDEN");
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it("primary class match (Course.classId) passes", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      classId: "class-A",
      classes: [],
    });
    await expect(
      assertCourseAccessForStudent("course-1", "class-A"),
    ).resolves.toBeUndefined();
  });

  it("CourseClass secondary class match passes", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      classId: "class-A",
      classes: [{ classId: "class-B" }, { classId: "class-C" }],
    });
    await expect(
      assertCourseAccessForStudent("course-1", "class-C"),
    ).resolves.toBeUndefined();
  });

  it("non-matching classId throws FORBIDDEN", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      classId: "class-A",
      classes: [{ classId: "class-B" }],
    });
    await expect(
      assertCourseAccessForStudent("course-1", "class-Z"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("non-existent course throws COURSE_NOT_FOUND", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      assertCourseAccessForStudent("course-missing", "class-A"),
    ).rejects.toThrow("COURSE_NOT_FOUND");
  });
});

describe("assertCourseReadable (role dispatch)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin bypasses without DB query (delegates to assertCourseAccess)", async () => {
    await assertCourseReadable("course-1", {
      id: "admin-1",
      role: "admin",
      classId: null,
    });
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
    expect(prisma.courseTeacher.findUnique).not.toHaveBeenCalled();
  });

  it("teacher owner passes (delegates to assertCourseAccess)", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });
    await expect(
      assertCourseReadable("course-1", {
        id: "teacher-owner",
        role: "teacher",
        classId: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("teacher cross-account (non-owner, non-collab) throws FORBIDDEN", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });
    (prisma.courseTeacher.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      assertCourseReadable("course-1", {
        id: "teacher-other",
        role: "teacher",
        classId: null,
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("student in primary class passes (delegates to assertCourseAccessForStudent)", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      classId: "class-A",
      classes: [],
    });
    await expect(
      assertCourseReadable("course-1", {
        id: "student-1",
        role: "student",
        classId: "class-A",
      }),
    ).resolves.toBeUndefined();
  });

  it("student cross-class throws FORBIDDEN", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      classId: "class-A",
      classes: [{ classId: "class-B" }],
    });
    await expect(
      assertCourseReadable("course-1", {
        id: "student-1",
        role: "student",
        classId: "class-Z",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("student with no classId → FORBIDDEN (short-circuit, no DB)", async () => {
    await expect(
      assertCourseReadable("course-1", {
        id: "student-1",
        role: "student",
        classId: null,
      }),
    ).rejects.toThrow("FORBIDDEN");
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });
});
