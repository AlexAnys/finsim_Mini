import { describe, it, expect } from "vitest";
import {
  buildTeacherList,
  displayInitial,
  buildClassNames,
  buildCourseMetrics,
  buildTeacherCourseSummary,
} from "@/lib/utils/teacher-courses-transforms";

const NOW = new Date("2026-04-23T10:00:00Z");

describe("buildTeacherList", () => {
  it("creator first, then collaborators, deduped by teacher.id", () => {
    const course = {
      creator: { id: "T1", name: "张老师", email: "t1@x.com" },
      teachers: [
        { teacher: { id: "T2", name: "李老师", email: "t2@x.com" } },
        { teacher: { id: "T1", name: "张老师", email: "t1@x.com" } }, // dup
        { teacher: { id: "T3", name: null, email: "wang@x.com" } },
      ],
    };
    const list = buildTeacherList(course);
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({
      id: "T1",
      name: "张老师",
      email: "t1@x.com",
      isCreator: true,
    });
    expect(list[1].id).toBe("T2");
    expect(list[2].id).toBe("T3");
    expect(list[2].name).toBe("W"); // fallback from email local
    expect(list[1].isCreator).toBe(false);
  });

  it("handles missing creator + empty teachers gracefully", () => {
    const list = buildTeacherList({});
    expect(list).toEqual([]);
  });

  it("creator without name uses email fallback", () => {
    const list = buildTeacherList({
      creator: { id: "A", name: null, email: "zhao@x.com" },
    });
    expect(list[0].name).toBe("Z");
  });
});

describe("displayInitial", () => {
  it("Chinese name first character", () => {
    expect(displayInitial("李老师")).toBe("李");
  });
  it("Latin name first letter uppercased", () => {
    expect(displayInitial("alice wang")).toBe("A");
  });
  it("empty or null → '师'", () => {
    expect(displayInitial("")).toBe("师");
    expect(displayInitial(null)).toBe("师");
    expect(displayInitial(undefined)).toBe("师");
  });
  it("leading whitespace trimmed", () => {
    expect(displayInitial("   张老师 ")).toBe("张");
  });
});

describe("buildClassNames", () => {
  it("uses CourseClass list when non-empty", () => {
    const names = buildClassNames({
      class: { name: "主班" },
      classes: [
        { class: { name: "金融22-1" } },
        { class: { name: "金融22-2" } },
        { class: { name: "金融22-1" } }, // dup
      ],
    });
    expect(names).toEqual(["金融22-1", "金融22-2"]);
  });

  it("falls back to primary class when CourseClass is empty", () => {
    expect(buildClassNames({ class: { name: "主班" }, classes: [] })).toEqual([
      "主班",
    ]);
  });

  it("empty when neither is present", () => {
    expect(buildClassNames({})).toEqual([]);
  });
});

describe("buildCourseMetrics", () => {
  const makeTi = (
    id: string,
    courseId: string,
    status: string,
    avgScore: number | null,
    studentCount: number,
  ) => ({
    id,
    courseId,
    course: { id: courseId },
    status,
    class: { _count: { students: studentCount } },
    analytics: avgScore != null ? { avgScore } : {},
  });

  it("taskCount, publishedCount, studentCount, avgScore", () => {
    const tis = [
      makeTi("ti1", "c1", "published", 80, 40),
      makeTi("ti2", "c1", "draft", null, 40),
      makeTi("ti3", "c1", "published", 90, 38),
      makeTi("ti4", "c2", "published", 50, 20), // other course — excluded
    ];
    const m = buildCourseMetrics("c1", tis, []);
    expect(m.taskCount).toBe(3);
    expect(m.publishedCount).toBe(2);
    expect(m.studentCount).toBe(40); // max across c1 instances
    expect(m.avgScore).toBe(85);
  });

  it("pendingCount = submissions with submitted/grading on c1 instances", () => {
    const tis = [
      makeTi("ti1", "c1", "published", null, 40),
      makeTi("ti2", "c1", "published", null, 40),
      makeTi("ti9", "c2", "published", null, 20),
    ];
    const subs = [
      { taskInstanceId: "ti1", status: "submitted" },
      { taskInstanceId: "ti2", status: "grading" },
      { taskInstanceId: "ti2", status: "graded" }, // excluded
      { taskInstanceId: "ti9", status: "submitted" }, // wrong course
    ];
    const m = buildCourseMetrics("c1", tis, subs);
    expect(m.pendingCount).toBe(2);
  });

  it("avgScore = null when no graded analytics", () => {
    const tis = [makeTi("ti1", "c1", "published", null, 40)];
    const m = buildCourseMetrics("c1", tis, []);
    expect(m.avgScore).toBeNull();
  });
});

describe("buildTeacherCourseSummary", () => {
  it("sums unique class sizes from instances", () => {
    const summary = buildTeacherCourseSummary({
      courses: [{ id: "c1" }, { id: "c2" }],
      taskInstances: [
        { class: { id: "CA", _count: { students: 40 } }, status: "draft" },
        { class: { id: "CA", _count: { students: 40 } }, status: "draft" }, // same class
        { class: { id: "CB", _count: { students: 30 } }, status: "draft" },
      ],
      pendingCount: 7,
      now: NOW,
    });
    expect(summary.totalCourses).toBe(2);
    expect(summary.totalStudents).toBe(70); // 40 + 30, no double count
    expect(summary.totalPending).toBe(7);
  });

  it("totalActiveTasks counts published instances with dueAt within 7d past or future", () => {
    const sevenDaysAgoMinusMin = new Date(
      NOW.getTime() - 7 * 24 * 3_600_000 - 60_000,
    );
    const twoDaysPast = new Date(NOW.getTime() - 2 * 24 * 3_600_000);
    const future = new Date(NOW.getTime() + 3 * 24 * 3_600_000);
    const summary = buildTeacherCourseSummary({
      courses: [],
      taskInstances: [
        {
          status: "published",
          dueAt: sevenDaysAgoMinusMin,
          class: { id: "X", _count: { students: 10 } },
        }, // too old — excluded
        {
          status: "published",
          dueAt: twoDaysPast,
          class: { id: "X", _count: { students: 10 } },
        },
        {
          status: "published",
          dueAt: future,
          class: { id: "X", _count: { students: 10 } },
        },
        {
          status: "draft",
          dueAt: future,
          class: { id: "X", _count: { students: 10 } },
        }, // not published
      ],
      pendingCount: 0,
      now: NOW,
    });
    expect(summary.totalActiveTasks).toBe(2);
  });
});
