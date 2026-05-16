import { describe, it, expect } from "vitest";
import { teacherCourseFilter, courseClassFilter } from "@/lib/services/course.service";

describe("courseClassFilter", () => {
  it("matches courses linked via CourseClass M:N (Course.classId 已弃用)", () => {
    const filter = courseClassFilter("class-X");
    expect(filter).toEqual({
      classes: { some: { classId: "class-X" } },
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
