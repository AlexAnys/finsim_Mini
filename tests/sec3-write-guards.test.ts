import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
    submission: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    taskInstance: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

/**
 * SEC3 write-side guard integration tests.
 *
 * The SEC3 route patches reuse two existing guards as write-side checks:
 * - assertCourseAccess (content-blocks/[id]/markdown PUT)
 * - assertSubmissionReadable (submissions/[id] DELETE, submissions/[id]/grade POST)
 *
 * These tests specifically exercise the write-use patterns: the guards must
 * reject teacher2→teacher1 resources with FORBIDDEN even when the caller
 * intends to modify/delete. Behavior of these guards was already tested in
 * SEC1/SEC2; this file documents the SEC3 call-site semantics.
 */

describe("SEC3 - content-blocks markdown PUT guard (assertCourseAccess)", () => {
  it("teacher non-owner non-collab: FORBIDDEN (write bypass prevented)", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "t-owner",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertCourseAccess("c1", "t-stranger", "teacher"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher owner: write permitted", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "t-owner",
    });
    await expect(
      assertCourseAccess("c1", "t-owner", "teacher"),
    ).resolves.toBeUndefined();
  });

  it("admin: write permitted (bypass)", async () => {
    await expect(
      assertCourseAccess("c1", "admin-1", "admin"),
    ).resolves.toBeUndefined();
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it("teacher collab (CourseTeacher row exists): write permitted", async () => {
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "t-owner",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({ id: "ct1" });
    await expect(
      assertCourseAccess("c1", "t-collab", "teacher"),
    ).resolves.toBeUndefined();
  });
});

describe("SEC3 - submissions DELETE guard (assertSubmissionReadable)", () => {
  it("teacher non-owner of the underlying task → FORBIDDEN (delete prevented)", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    mk(prisma.task.findUnique).mockResolvedValue({ creatorId: "t-owner" });
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      courseId: "c1",
      createdBy: "t-owner",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "t-owner",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue(null);
    await expect(
      assertSubmissionReadable("sub-1", {
        id: "t-stranger",
        role: "teacher",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher as task creator: delete permitted", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    mk(prisma.task.findUnique).mockResolvedValue({ creatorId: "t-owner" });
    await expect(
      assertSubmissionReadable("sub-1", { id: "t-owner", role: "teacher" }),
    ).resolves.toBeUndefined();
  });

  it("admin: delete permitted (bypass)", async () => {
    await expect(
      assertSubmissionReadable("sub-1", { id: "admin-1", role: "admin" }),
    ).resolves.toBeUndefined();
    expect(prisma.submission.findUnique).not.toHaveBeenCalled();
  });
});

describe("SEC3 - submissions grade POST guard (assertSubmissionReadable)", () => {
  it("teacher non-owner of underlying task cannot regrade → FORBIDDEN", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: null,
    });
    mk(prisma.task.findUnique).mockResolvedValue({ creatorId: "t-owner" });
    await expect(
      assertSubmissionReadable("sub-1", {
        id: "t-stranger",
        role: "teacher",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher with course access via instance can regrade: permitted", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      studentId: "s1",
      taskId: "task-1",
      taskInstanceId: "ti-1",
    });
    mk(prisma.task.findUnique).mockResolvedValue({ creatorId: "someone" });
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      courseId: "c1",
      createdBy: "someone",
    });
    mk(prisma.course.findUnique).mockResolvedValue({
      id: "c1",
      createdBy: "someone",
    });
    mk(prisma.courseTeacher.findUnique).mockResolvedValue({ id: "ct1" });
    await expect(
      assertSubmissionReadable("sub-1", {
        id: "t-collab",
        role: "teacher",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("SEC3 - fail-closed semantics", () => {
  it("non-existent submission → SUBMISSION_NOT_FOUND (not silent passthrough)", async () => {
    mk(prisma.submission.findUnique).mockResolvedValue(null);
    await expect(
      assertSubmissionReadable("missing", { id: "t1", role: "teacher" }),
    ).rejects.toThrow("SUBMISSION_NOT_FOUND");
  });

  it("non-existent course → COURSE_NOT_FOUND on markdown PUT guard", async () => {
    mk(prisma.course.findUnique).mockResolvedValue(null);
    await expect(
      assertCourseAccess("missing", "t1", "teacher"),
    ).rejects.toThrow("COURSE_NOT_FOUND");
  });
});
