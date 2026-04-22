import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseClass: { delete: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { removeCourseClass } from "@/lib/services/course.service";

describe("removeCourseClass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws CANNOT_REMOVE_PRIMARY_CLASS when classId matches course.classId", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      classId: "class-primary",
    });

    await expect(removeCourseClass("course-1", "class-primary")).rejects.toThrow(
      "CANNOT_REMOVE_PRIMARY_CLASS"
    );
    expect(prisma.courseClass.delete).not.toHaveBeenCalled();
  });

  it("deletes CourseClass when classId differs from course.classId", async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      classId: "class-primary",
    });
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
