import { describe, it, expect } from "vitest";
import {
  teacherCourseFilter,
  teacherCourseScope,
  courseClassFilter,
} from "@/lib/services/course.service";

describe("teacherCourseScope", () => {
  it("matches courses the teacher created or collaborates on (无 deletedAt 过滤，供回收站用)", () => {
    const scope = teacherCourseScope("teacher-1");
    expect(scope).toEqual({
      OR: [{ createdBy: "teacher-1" }, { teachers: { some: { teacherId: "teacher-1" } } }],
    });
  });
});

describe("teacherCourseFilter", () => {
  it("scope + deletedAt:null（U3-F3：已归档课程从老师面消失）", () => {
    const filter = teacherCourseFilter("teacher-1");
    expect(filter).toEqual({
      AND: [
        { OR: [{ createdBy: "teacher-1" }, { teachers: { some: { teacherId: "teacher-1" } } }] },
        { deletedAt: null },
      ],
    });
  });
});

describe("courseClassFilter", () => {
  it("CourseClass M:N 匹配 + deletedAt:null（U3-F3：已归档课程从学生面消失）", () => {
    const filter = courseClassFilter("class-X");
    expect(filter).toEqual({
      AND: [{ classes: { some: { classId: "class-X" } } }, { deletedAt: null }],
    });
  });
});
