import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskInstance: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    task: { findUnique: vi.fn() },
    course: { findUnique: vi.fn(), findFirst: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
    submission: { findUnique: vi.fn() },
    importJob: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  assertTaskInstanceReadable,
  assertTaskInstanceReadableTeacherOnly,
  assertTaskReadable,
  assertClassAccessForTeacher,
  assertSubmissionReadable,
  assertImportJobReadable,
} from "@/lib/auth/resource-access";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("assertTaskInstanceReadable", () => {
  it("admin bypasses without DB query", async () => {
    await assertTaskInstanceReadable("ti-1", { id: "admin-1", role: "admin" });
    expect(prisma.taskInstance.findUnique).not.toHaveBeenCalled();
  });

  it("non-existent → INSTANCE_NOT_FOUND", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue(null);
    await expect(
      assertTaskInstanceReadable("ti-missing", { id: "t1", role: "teacher" }),
    ).rejects.toThrow("INSTANCE_NOT_FOUND");
  });

  it("student in matching class on published instance passes", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "class-A",
      courseId: "c1",
      createdBy: "t1",
      status: "published",
    });
    await expect(
      assertTaskInstanceReadable("ti-1", {
        id: "s1",
        role: "student",
        classId: "class-A",
      }),
    ).resolves.toBeUndefined();
  });

  it("student on non-published instance throws FORBIDDEN", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "class-A",
      courseId: "c1",
      createdBy: "t1",
      status: "draft",
    });
    await expect(
      assertTaskInstanceReadable("ti-1", {
        id: "s1",
        role: "student",
        classId: "class-A",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("student cross-class throws FORBIDDEN", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "class-A",
      courseId: "c1",
      createdBy: "t1",
      status: "published",
    });
    await expect(
      assertTaskInstanceReadable("ti-1", {
        id: "s1",
        role: "student",
        classId: "class-Z",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher is createdBy passes", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "c-any",
      courseId: "c1",
      createdBy: "t1",
      status: "published",
    });
    await expect(
      assertTaskInstanceReadable("ti-1", { id: "t1", role: "teacher" }),
    ).resolves.toBeUndefined();
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it("teacher with course access (not creator) passes via course", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "c-any",
      courseId: "c1",
      createdBy: "owner",
      status: "published",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "t-owner",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({ id: "ct1" });
    await expect(
      assertTaskInstanceReadable("ti-1", { id: "t-collab", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("teacher without course access throws FORBIDDEN", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "c-any",
      courseId: "c1",
      createdBy: "owner",
      status: "published",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertTaskInstanceReadable("ti-1", { id: "t-other", role: "teacher" }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("standalone instance (no courseId) not owned by teacher → FORBIDDEN", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "c-any",
      courseId: null,
      createdBy: "owner",
      status: "published",
    });
    await expect(
      assertTaskInstanceReadable("ti-1", { id: "other-t", role: "teacher" }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("assertTaskInstanceReadableTeacherOnly", () => {
  it("student rejected without DB lookup", async () => {
    await expect(
      assertTaskInstanceReadableTeacherOnly("ti", {
        id: "s1",
        role: "student",
        classId: "cls",
      }),
    ).rejects.toThrow("FORBIDDEN");
    expect(prisma.taskInstance.findUnique).not.toHaveBeenCalled();
  });

  it("teacher with access still passes", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      classId: "c-any",
      courseId: "c1",
      createdBy: "t1",
      status: "published",
    });
    await expect(
      assertTaskInstanceReadableTeacherOnly("ti-1", {
        id: "t1",
        role: "teacher",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("assertTaskReadable", () => {
  it("admin bypasses", async () => {
    await assertTaskReadable("task-1", { id: "admin-1", role: "admin" });
    expect(prisma.task.findUnique).not.toHaveBeenCalled();
  });

  it("non-existent → TASK_NOT_FOUND", async () => {
    mk(prisma.task.findUnique).mockResolvedValue(null);
    await expect(
      assertTaskReadable("missing", { id: "t1", role: "teacher" }),
    ).rejects.toThrow("TASK_NOT_FOUND");
  });

  it("teacher creator passes", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      creatorId: "t1",
    });
    await expect(
      assertTaskReadable("task-1", { id: "t1", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("student with assigned published instance passes", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      creatorId: "t1",
    });
    mk(prisma.taskInstance.findFirst).mockResolvedValue({ id: "ti-1" });
    await expect(
      assertTaskReadable("task-1", {
        id: "s1",
        role: "student",
        classId: "cls-A",
      }),
    ).resolves.toBeUndefined();
  });

  it("student without assigned instance throws FORBIDDEN", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      creatorId: "t1",
    });
    mk(prisma.taskInstance.findFirst).mockResolvedValue(null);
    await expect(
      assertTaskReadable("task-1", {
        id: "s1",
        role: "student",
        classId: "cls-A",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("student without classId throws FORBIDDEN (short-circuit)", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      creatorId: "t1",
    });
    await expect(
      assertTaskReadable("task-1", {
        id: "s1",
        role: "student",
        classId: null,
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher non-creator with course access via instance passes", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      creatorId: "owner",
    });
    mk(prisma.taskInstance.findMany).mockResolvedValue([{ courseId: "c1" }]);
    // assertCourseAccess: first findUnique returns course, courseTeacher returns row
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "someone",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({ id: "ct" });
    await expect(
      assertTaskReadable("task-1", { id: "t-collab", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("teacher non-creator with no course access throws FORBIDDEN", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      creatorId: "owner",
    });
    mk(prisma.taskInstance.findMany).mockResolvedValue([{ courseId: "c1" }]);
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertTaskReadable("task-1", { id: "t-other", role: "teacher" }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("assertClassAccessForTeacher", () => {
  it("admin bypasses", async () => {
    await assertClassAccessForTeacher("cls-1", {
      id: "admin-1",
      role: "admin",
    });
    expect(prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it("student rejected", async () => {
    await expect(
      assertClassAccessForTeacher("cls-1", {
        id: "s1",
        role: "student",
        classId: "cls-1",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("non-existent class → CLASS_NOT_FOUND", async () => {
    mk(prisma.class.findUnique).mockResolvedValue(null);
    await expect(
      assertClassAccessForTeacher("missing", { id: "t1", role: "teacher" }),
    ).rejects.toThrow("CLASS_NOT_FOUND");
  });

  it("teacher teaching a course on this class passes", async () => {
    mk(prisma.class.findUnique).mockResolvedValue({ id: "cls-1" });
    mk(prisma.course.findFirst).mockResolvedValue({ id: "c1" });
    await expect(
      assertClassAccessForTeacher("cls-1", { id: "t1", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("teacher NOT teaching any course on class throws FORBIDDEN", async () => {
    mk(prisma.class.findUnique).mockResolvedValue({ id: "cls-1" });
    mk(prisma.course.findFirst).mockResolvedValue(null);
    await expect(
      assertClassAccessForTeacher("cls-1", {
        id: "t-stranger",
        role: "teacher",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("assertSubmissionReadable", () => {
  it("admin bypasses", async () => {
    await assertSubmissionReadable("sub-1", { id: "admin", role: "admin" });
    expect(prisma.submission.findUnique).not.toHaveBeenCalled();
  });

  it("non-existent → SUBMISSION_NOT_FOUND", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue(null);
    await expect(
      assertSubmissionReadable("missing", { id: "t1", role: "teacher" }),
    ).rejects.toThrow("SUBMISSION_NOT_FOUND");
  });

  it("student owner of submission passes", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    await expect(
      assertSubmissionReadable("sub-1", { id: "s1", role: "student" }),
    ).resolves.toBeUndefined();
  });

  it("student non-owner throws FORBIDDEN", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    await expect(
      assertSubmissionReadable("sub-1", { id: "s-other", role: "student" }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher creator of the task passes", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    mk(prisma.task.findUnique).mockResolvedValue({ creatorId: "t1" });
    await expect(
      assertSubmissionReadable("sub-1", { id: "t1", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("teacher non-creator with course access passes", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    mk(prisma.task.findUnique).mockResolvedValue({ creatorId: "owner" });
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      courseId: "c1",
      createdBy: "owner",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "someone",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({ id: "ct" });
    await expect(
      assertSubmissionReadable("sub-1", { id: "t-collab", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("teacher with no access throws FORBIDDEN", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    mk(prisma.task.findUnique).mockResolvedValue({ creatorId: "owner" });
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      courseId: "c1",
      createdBy: "owner",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "other",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertSubmissionReadable("sub-1", { id: "t-stranger", role: "teacher" }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("assertImportJobReadable", () => {
  it("admin bypasses", async () => {
    await assertImportJobReadable("job-1", { id: "admin", role: "admin" });
    expect(prisma.importJob.findUnique).not.toHaveBeenCalled();
  });

  it("non-existent → JOB_NOT_FOUND", async () => {
    mk(prisma.importJob.findUnique).mockResolvedValue(null);
    await expect(
      assertImportJobReadable("missing", { id: "t1", role: "teacher" }),
    ).rejects.toThrow("JOB_NOT_FOUND");
  });

  it("job teacher owner passes", async () => {
    mk(prisma.importJob.findUnique).mockResolvedValue({
      id: "job-1",
      teacherId: "t1",
    });
    await expect(
      assertImportJobReadable("job-1", { id: "t1", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("non-owner teacher throws FORBIDDEN", async () => {
    mk(prisma.importJob.findUnique).mockResolvedValue({
      id: "job-1",
      teacherId: "t1",
    });
    await expect(
      assertImportJobReadable("job-1", { id: "t-other", role: "teacher" }),
    ).rejects.toThrow("FORBIDDEN");
  });
});
