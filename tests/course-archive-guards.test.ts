import { describe, it, expect, vi, beforeEach } from "vitest";

// U3-F1/F2: 学生守卫拒已归档课程 + grades(getSubmissions) 过滤已归档课程提交。
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
    taskInstance: { findUnique: vi.fn(), findFirst: vi.fn() },
    submission: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { assertCourseAccessForStudent, assertCourseNotArchived } from "@/lib/auth/course-access";
import { assertTaskInstanceReadable } from "@/lib/auth/resource-access";
import { getSubmissions } from "@/lib/services/submission.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("F1: assertCourseAccessForStudent 拒已归档课程", () => {
  beforeEach(() => vi.clearAllMocks());

  it("课程已归档（deletedAt 非空）→ 学生 FORBIDDEN，即使班级匹配", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      deletedAt: new Date(),
      classes: [{ classId: "class-A" }],
    });
    await expect(assertCourseAccessForStudent("c-1", "class-A")).rejects.toThrow("FORBIDDEN");
  });

  it("课程正常（deletedAt null）+ 班级匹配 → 通过", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      deletedAt: null,
      classes: [{ classId: "class-A" }],
    });
    await expect(assertCourseAccessForStudent("c-1", "class-A")).resolves.toBeUndefined();
  });
});

describe("F1: assertTaskInstanceReadable 学生分支拒已归档课程实例", () => {
  beforeEach(() => vi.clearAllMocks());

  it("实例 published 但所属课程已归档 → 学生 FORBIDDEN", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti-1",
      classId: "class-A",
      courseId: "c-1",
      createdBy: "t1",
      status: "published",
      course: { deletedAt: new Date() },
    });
    await expect(
      assertTaskInstanceReadable("ti-1", { id: "s1", role: "student", classId: "class-A" }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("实例 published 且课程正常 → 学生通过", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti-1",
      classId: "class-A",
      courseId: "c-1",
      createdBy: "t1",
      status: "published",
      course: { deletedAt: null },
    });
    await expect(
      assertTaskInstanceReadable("ti-1", { id: "s1", role: "student", classId: "class-A" }),
    ).resolves.toBeUndefined();
  });

  it("Bucket 4：teacher/owner 分支对已归档课程实例保持开放（恢复用）", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti-1",
      classId: "class-A",
      courseId: "c-1",
      createdBy: "t-owner",
      status: "published",
      course: { deletedAt: new Date() },
    });
    // createdBy === user.id → 直接通过，不受归档影响
    await expect(
      assertTaskInstanceReadable("ti-1", { id: "t-owner", role: "teacher", classId: null }),
    ).resolves.toBeUndefined();
  });
});

describe("F2: getSubmissions 过滤已归档课程提交", () => {
  beforeEach(() => vi.clearAllMocks());

  it("按 studentId 查询时 where 含'非归档课程 OR 无实例'（保留 standalone）", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.submission.count).mockResolvedValue(0);
    await getSubmissions({ studentId: "s-1" });
    const where = mk(prisma.submission.findMany).mock.calls[0][0].where;
    expect(where.studentId).toBe("s-1");
    expect(where.OR).toEqual([
      { taskInstanceId: null },
      { taskInstance: { course: { deletedAt: null } } },
    ]);
  });

  it("按显式 taskInstanceId 查询时不加归档闸（实例守卫已管 + owner 需访问）", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.submission.count).mockResolvedValue(0);
    await getSubmissions({ taskInstanceId: "ti-1" });
    const where = mk(prisma.submission.findMany).mock.calls[0][0].where;
    expect(where.taskInstanceId).toBe("ti-1");
    expect(where.OR).toBeUndefined();
  });
});

describe("F4: assertCourseNotArchived 写路径守卫", () => {
  beforeEach(() => vi.clearAllMocks());

  it("课程已归档 → COURSE_ARCHIVED", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({ id: "c-1", deletedAt: new Date() });
    await expect(assertCourseNotArchived("c-1")).rejects.toThrow("COURSE_ARCHIVED");
  });

  it("课程正常（deletedAt null）→ 通过", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({ id: "c-1", deletedAt: null });
    await expect(assertCourseNotArchived("c-1")).resolves.toBeUndefined();
  });

  it("课程不存在 → COURSE_NOT_FOUND", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(null);
    await expect(assertCourseNotArchived("missing")).rejects.toThrow("COURSE_NOT_FOUND");
  });
});
