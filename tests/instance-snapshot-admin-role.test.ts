import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskInstance: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    submission: {
      count: vi.fn(),
    },
    courseTeacher: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db/prisma";
import { updateTaskInstanceSnapshot } from "@/lib/services/task-instance.service";

const mFind = () =>
  prisma.taskInstance.findUnique as unknown as ReturnType<typeof vi.fn>;
const mUpdate = () =>
  prisma.taskInstance.update as unknown as ReturnType<typeof vi.fn>;
const mCollab = () =>
  prisma.courseTeacher.findUnique as unknown as ReturnType<typeof vi.fn>;
const mTx = () => prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

/**
 * Slice 4 (B3) · admin 应能管理所有 instance（即便不是 createdBy / 不在 courseTeacher）。
 * review_arch F-4 — `isAuthorizedForInstance` 只查 createdBy + courseTeacher，admin 被错误拒绝。
 */

describe("Slice 4 · updateTaskInstanceSnapshot admin auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin role 绕过 createdBy / courseTeacher 检查正常更新", async () => {
    mFind().mockResolvedValue({
      id: "i1",
      createdBy: "teacher-1",
      courseId: "course-1",
      taskType: "quiz",
      taskSnapshot: {
        id: "t1",
        taskType: "quiz",
        taskName: "测验",
        quizConfig: { mode: "fixed", timeLimitMinutes: 30 },
      },
    });
    // admin 既不是 createdBy 也不在 courseTeacher
    mCollab().mockResolvedValue(null);
    mTx().mockImplementation(async () => [{ id: "i1" }, 0]);

    await expect(
      updateTaskInstanceSnapshot(
        "i1",
        "admin-user-id",
        { taskType: "quiz", quizConfig: { mode: "adaptive" } },
        "admin",
      ),
    ).resolves.toBeDefined();

    expect(mUpdate()).toHaveBeenCalledTimes(1);
    // admin 短路 → 不应查 courseTeacher
    expect(mCollab()).not.toHaveBeenCalled();
  });

  it("teacher 非 createdBy 非 collab 仍抛 FORBIDDEN（保持现有行为）", async () => {
    mFind().mockResolvedValue({
      id: "i2",
      createdBy: "teacher-1",
      courseId: "course-1",
      taskType: "quiz",
      taskSnapshot: { id: "t2", taskType: "quiz" },
    });
    mCollab().mockResolvedValue(null);

    await expect(
      updateTaskInstanceSnapshot(
        "i2",
        "other-teacher",
        { taskType: "quiz", quizConfig: { mode: "fixed" } },
        "teacher",
      ),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("teacher 是 createdBy 仍通过（保持现有行为）", async () => {
    mFind().mockResolvedValue({
      id: "i3",
      createdBy: "teacher-1",
      courseId: "course-1",
      taskType: "quiz",
      taskSnapshot: {
        id: "t3",
        taskType: "quiz",
        quizConfig: { mode: "fixed" },
      },
    });
    mTx().mockImplementation(async () => [{ id: "i3" }, 0]);

    await expect(
      updateTaskInstanceSnapshot(
        "i3",
        "teacher-1",
        { taskType: "quiz", quizConfig: { mode: "adaptive" } },
        "teacher",
      ),
    ).resolves.toBeDefined();
  });

  it("teacher 是 collab 仍通过（保持现有行为）", async () => {
    mFind().mockResolvedValue({
      id: "i4",
      createdBy: "teacher-1",
      courseId: "course-1",
      taskType: "quiz",
      taskSnapshot: {
        id: "t4",
        taskType: "quiz",
        quizConfig: { mode: "fixed" },
      },
    });
    mCollab().mockResolvedValue({ id: "ct-1" });
    mTx().mockImplementation(async () => [{ id: "i4" }, 0]);

    await expect(
      updateTaskInstanceSnapshot(
        "i4",
        "collab-teacher",
        { taskType: "quiz", quizConfig: { mode: "adaptive" } },
        "teacher",
      ),
    ).resolves.toBeDefined();
  });
});
