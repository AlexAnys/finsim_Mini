import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    taskInstance: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  assertTaskInstanceReadable,
  assertTaskReadable,
} from "@/lib/auth/resource-access";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

/**
 * SEC4 — GET /api/submissions list endpoint owner guard.
 *
 * Pre-existing P1: GET /api/submissions?taskInstanceId=X had no owner check;
 * teacher2 could enumerate teacher1's submissions.
 *
 * Fix: route handler now calls assertTaskInstanceReadable / assertTaskReadable
 * for teacher/admin callers when those filters are passed, AND requires at
 * least one scope filter (taskInstanceId / taskId / studentId) to prevent a
 * broad scan.
 *
 * These tests document the guard behavior at the call-site we now wire in.
 */

describe("SEC4 - assertTaskInstanceReadable used by GET /api/submissions", () => {
  it("teacher non-owner non-collab on standalone instance: FORBIDDEN", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      classId: "cls1",
      courseId: null,
      createdBy: "teacher-A",
      status: "published",
    });
    await expect(
      assertTaskInstanceReadable("ti1", {
        id: "teacher-B",
        role: "teacher",
        classId: null,
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher owner of instance: OK (no throw)", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      classId: "cls1",
      courseId: null,
      createdBy: "teacher-A",
      status: "published",
    });
    await expect(
      assertTaskInstanceReadable("ti1", {
        id: "teacher-A",
        role: "teacher",
        classId: null,
      })
    ).resolves.toBeUndefined();
  });

  it("teacher with course-collab access: OK via course-access path", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "ti1",
      classId: "cls1",
      courseId: "c1",
      createdBy: "teacher-A",
      status: "published",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "teacher-A",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({
      courseId: "c1",
      teacherId: "teacher-collab",
    });
    await expect(
      assertTaskInstanceReadable("ti1", {
        id: "teacher-collab",
        role: "teacher",
        classId: null,
      })
    ).resolves.toBeUndefined();
  });

  it("admin: bypass without any DB read", async () => {
    await expect(
      assertTaskInstanceReadable("ti1", {
        id: "admin1",
        role: "admin",
        classId: null,
      })
    ).resolves.toBeUndefined();
    expect(mk(prisma.taskInstance.findUnique)).not.toHaveBeenCalled();
  });

  it("not-found instance: throws INSTANCE_NOT_FOUND", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue(null);
    await expect(
      assertTaskInstanceReadable("missing", {
        id: "teacher-A",
        role: "teacher",
        classId: null,
      })
    ).rejects.toThrow("INSTANCE_NOT_FOUND");
  });
});

describe("SEC4 - assertTaskReadable used by GET /api/submissions?taskId=X", () => {
  it("teacher non-creator with no instance course access: FORBIDDEN", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "t1",
      creatorId: "teacher-A",
    });
    mk(prisma.taskInstance.findMany).mockResolvedValue([]);
    await expect(
      assertTaskReadable("t1", {
        id: "teacher-B",
        role: "teacher",
        classId: null,
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher creator: OK", async () => {
    mk(prisma.task.findUnique).mockResolvedValue({
      id: "t1",
      creatorId: "teacher-A",
    });
    await expect(
      assertTaskReadable("t1", {
        id: "teacher-A",
        role: "teacher",
        classId: null,
      })
    ).resolves.toBeUndefined();
  });
});
