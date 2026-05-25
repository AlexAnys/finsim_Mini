import { describe, it, expect, vi, beforeEach } from "vitest";

// U2: archive/restore/purge/listArchived service。mock prisma + audit。
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  archiveCourse,
  restoreCourse,
  getArchivedCourses,
  purgeCourse,
} from "@/lib/services/course.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("archiveCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("owner 归档：置 deletedAt 时间戳，不校验章节/实例", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      courseTitle: "金融学",
      createdBy: "u-1",
      deletedAt: null,
    });
    mk(prisma.course.update).mockResolvedValue({ id: "c-1", deletedAt: new Date() });

    await archiveCourse("c-1", "u-1", "teacher");

    const call = mk(prisma.course.update).mock.calls[0][0];
    expect(call.where).toEqual({ id: "c-1" });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it("admin 可归档他人课程", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-2",
      courseTitle: "会计学",
      createdBy: "someone-else",
      deletedAt: null,
    });
    mk(prisma.course.update).mockResolvedValue({ id: "c-2", deletedAt: new Date() });

    await expect(archiveCourse("c-2", "admin-1", "admin")).resolves.toBeDefined();
    expect(prisma.course.update).toHaveBeenCalled();
  });

  it("非 owner 非 admin → FORBIDDEN，不写库", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-3",
      courseTitle: "x",
      createdBy: "owner-x",
      deletedAt: null,
    });
    await expect(archiveCourse("c-3", "intruder", "teacher")).rejects.toThrow("FORBIDDEN");
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it("课程不存在 → COURSE_NOT_FOUND", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(null);
    await expect(archiveCourse("missing", "u-1", "teacher")).rejects.toThrow("COURSE_NOT_FOUND");
    expect(prisma.course.update).not.toHaveBeenCalled();
  });
});

describe("restoreCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("owner 恢复：清空 deletedAt", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      courseTitle: "金融学",
      createdBy: "u-1",
      deletedAt: new Date(),
    });
    mk(prisma.course.update).mockResolvedValue({ id: "c-1", deletedAt: null });

    await restoreCourse("c-1", "u-1", "teacher");

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { deletedAt: null },
    });
  });

  it("非 owner → FORBIDDEN", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      courseTitle: "x",
      createdBy: "owner-x",
      deletedAt: new Date(),
    });
    await expect(restoreCourse("c-1", "intruder", "teacher")).rejects.toThrow("FORBIDDEN");
    expect(prisma.course.update).not.toHaveBeenCalled();
  });
});

describe("getArchivedCourses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("teacher：deletedAt 非空 + teacherCourseFilter", async () => {
    mk(prisma.course.findMany).mockResolvedValue([]);
    await getArchivedCourses("u-1", "teacher");
    const where = mk(prisma.course.findMany).mock.calls[0][0].where;
    expect(where).toEqual({
      AND: [
        { deletedAt: { not: null } },
        { OR: [{ createdBy: "u-1" }, { teachers: { some: { teacherId: "u-1" } } }] },
      ],
    });
  });

  it("admin：仅 deletedAt 非空（不限 teacher）", async () => {
    mk(prisma.course.findMany).mockResolvedValue([]);
    await getArchivedCourses("admin-1", "admin");
    const where = mk(prisma.course.findMany).mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: { not: null } });
  });
});

describe("purgeCourse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirmTitle 不符 → PURGE_TITLE_MISMATCH，且不进事务", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      courseTitle: "金融学",
      createdBy: "u-1",
      deletedAt: new Date(),
    });
    await expect(purgeCourse("c-1", "u-1", "teacher", "错误名字")).rejects.toThrow(
      "PURGE_TITLE_MISMATCH",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("非 owner → FORBIDDEN", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      courseTitle: "金融学",
      createdBy: "owner-x",
      deletedAt: new Date(),
    });
    await expect(purgeCourse("c-1", "intruder", "teacher", "金融学")).rejects.toThrow("FORBIDDEN");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("名称匹配 → 事务内按序删后代且不碰 Task 模板", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c-1",
      courseTitle: "金融学",
      createdBy: "u-1",
      deletedAt: new Date(),
    });

    // 构造 tx mock：记录被调用的 model.method，验证覆盖范围 + 不含 task。
    const calls: string[] = [];
    const makeModel = (name: string) => ({
      findMany: vi.fn(async () => {
        calls.push(`${name}.findMany`);
        return [];
      }),
      deleteMany: vi.fn(async () => {
        calls.push(`${name}.deleteMany`);
        return { count: 0 };
      }),
      delete: vi.fn(async () => {
        calls.push(`${name}.delete`);
        return {};
      }),
    });
    const tx = {
      chapter: makeModel("chapter"),
      section: makeModel("section"),
      contentBlock: makeModel("contentBlock"),
      taskInstance: makeModel("taskInstance"),
      submission: makeModel("submission"),
      subjectiveSubmission: makeModel("subjectiveSubmission"),
      simulationSubmission: makeModel("simulationSubmission"),
      quizSubmission: makeModel("quizSubmission"),
      attachment: makeModel("attachment"),
      studyBuddyPost: makeModel("studyBuddyPost"),
      taskPost: makeModel("taskPost"),
      analysisReport: makeModel("analysisReport"),
      courseKnowledgeSource: makeModel("courseKnowledgeSource"),
      taskBuildDraft: makeModel("taskBuildDraft"),
      announcement: makeModel("announcement"),
      scheduleSlot: makeModel("scheduleSlot"),
      courseTeacher: makeModel("courseTeacher"),
      courseClass: makeModel("courseClass"),
      course: makeModel("course"),
      // 故意提供 task，断言绝不被调用（F5：不删共享 Task 模板）
      task: makeModel("task"),
    };
    mk(prisma.$transaction).mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));

    await purgeCourse("c-1", "u-1", "teacher", "金融学");

    // 承重表都被删
    expect(calls).toContain("contentBlock.deleteMany");
    expect(calls).toContain("section.deleteMany");
    expect(calls).toContain("chapter.deleteMany");
    expect(calls).toContain("taskInstance.deleteMany");
    expect(calls).toContain("course.delete");
    // 共享 Task 模板绝不删
    expect(tx.task.deleteMany).not.toHaveBeenCalled();
    expect(tx.task.delete).not.toHaveBeenCalled();
    // course.delete 是最后一步
    expect(calls[calls.length - 1]).toBe("course.delete");
    // 承重次序：contentBlock → section → chapter → course（解两条 RESTRICT）
    expect(calls.indexOf("contentBlock.deleteMany")).toBeLessThan(calls.indexOf("section.deleteMany"));
    expect(calls.indexOf("section.deleteMany")).toBeLessThan(calls.indexOf("chapter.deleteMany"));
    expect(calls.indexOf("chapter.deleteMany")).toBeLessThan(calls.indexOf("course.delete"));
  });
});
