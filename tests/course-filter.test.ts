import { describe, it, expect } from "vitest";
import { teacherCourseFilter, courseClassFilter } from "@/lib/services/course.service";

describe("courseClassFilter", () => {
  it("matches either the primary Course.classId or a CourseClass.classId row", () => {
    const filter = courseClassFilter("class-X");
    expect(filter).toEqual({
      OR: [{ classId: "class-X" }, { classes: { some: { classId: "class-X" } } }],
    });
  });
});

describe("teacherCourseFilter", () => {
  it("matches courses the teacher created or collaborates on", () => {
    const filter = teacherCourseFilter("teacher-1");
    expect(filter).toEqual({
      OR: [{ createdBy: "teacher-1" }, { teachers: { some: { teacherId: "teacher-1" } } }],
    });
  });
});
