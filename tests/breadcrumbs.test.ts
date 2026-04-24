import { describe, it, expect } from "vitest";
import { deriveCrumbs } from "@/lib/layout/breadcrumbs";

describe("deriveCrumbs", () => {
  it("maps student root with known segments", () => {
    const crumbs = deriveCrumbs("/dashboard", "student");
    expect(crumbs).toEqual([
      { label: "学生", isLast: false },
      { label: "仪表盘", isLast: true },
    ]);
  });

  it("maps teacher prefix, stripping the leading 'teacher' segment", () => {
    const crumbs = deriveCrumbs("/teacher/courses", "teacher");
    expect(crumbs).toEqual([
      { label: "教师", isLast: false },
      { label: "我的课程", isLast: true },
    ]);
  });

  it("skips opaque ids like course/:id", () => {
    const crumbs = deriveCrumbs(
      "/teacher/courses/a1b2c3d4e5f6",
      "teacher",
    );
    expect(crumbs.map((c) => c.label)).toEqual(["教师", "我的课程"]);
    expect(crumbs[crumbs.length - 1].isLast).toBe(true);
  });

  it("falls back to raw segment for unknown labels", () => {
    const crumbs = deriveCrumbs("/custom-page", "student");
    expect(crumbs.map((c) => c.label)).toEqual(["学生", "custom-page"]);
  });

  it("handles root path '/' with only role crumb", () => {
    const crumbs = deriveCrumbs("/", "student");
    expect(crumbs).toEqual([{ label: "学生", isLast: true }]);
  });

  it("admin role uses '管理员' root", () => {
    const crumbs = deriveCrumbs("/teacher/groups", "admin");
    expect(crumbs[0]).toEqual({ label: "管理员", isLast: false });
    expect(crumbs[1]).toEqual({ label: "班级管理", isLast: true });
  });

  it("handles nested paths like /tasks/:id/new → '任务中心 / 新建'", () => {
    const crumbs = deriveCrumbs(
      "/teacher/tasks/abc12345/new",
      "teacher",
    );
    expect(crumbs.map((c) => c.label)).toEqual([
      "教师",
      "任务中心",
      "新建",
    ]);
    expect(crumbs[crumbs.length - 1].isLast).toBe(true);
  });

  it("undefined role defaults to student root", () => {
    const crumbs = deriveCrumbs("/dashboard", undefined);
    expect(crumbs[0].label).toBe("学生");
  });
});
