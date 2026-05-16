import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseClass: { count: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { removeCourseClass } from "@/lib/services/course.service";

describe("removeCourseClass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws MUST_KEEP_AT_LEAST_ONE_CLASS when removing the only CourseClass", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
    });
    (prisma.courseClass.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await expect(removeCourseClass("course-1", "class-only")).rejects.toThrow(
      "MUST_KEEP_AT_LEAST_ONE_CLASS"
    );
    expect(prisma.courseClass.delete).not.toHaveBeenCalled();
  });

  it("deletes CourseClass when at least one other association remains", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
    });
    (prisma.courseClass.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (prisma.courseClass.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: "course-1",
      classId: "class-secondary",
    });

    const result = await removeCourseClass("course-1", "class-secondary");
    expect(prisma.courseClass.delete).toHaveBeenCalledWith({
      where: { courseId_classId: { courseId: "course-1", classId: "class-secondary" } },
    });
    expect(result).toEqual({ courseId: "course-1", classId: "class-secondary" });
  });

  it("throws COURSE_NOT_FOUND when course does not exist", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(removeCourseClass("missing", "class-x")).rejects.toThrow("COURSE_NOT_FOUND");
    expect(prisma.courseClass.delete).not.toHaveBeenCalled();
  });
});
