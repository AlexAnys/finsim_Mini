import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    chapter: { findUnique: vi.fn() },
    section: { findUnique: vi.fn() },
    taskBuildDraft: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    asyncJob: { findMany: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAuditEvent: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/services/audit.service";
import {
  approveTaskBuildDraft,
  listTaskBuildDrafts,
  markTaskBuildDraftPublished,
} from "@/lib/services/task-build-draft.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveTaskBuildDraft", () => {
  it("approves a ready draft: writes audit + sets approved status with timestamp + actor", async () => {
    mk(prisma.taskBuildDraft.findUnique).mockResolvedValue({
      id: "draft-1",
      status: "ready",
      courseId: "course-1",
      title: "测验草稿",
    });
    mk(prisma.taskBuildDraft.update).mockResolvedValue({
      id: "draft-1",
      status: "approved",
      approvedAt: new Date("2026-05-14T13:50:00Z"),
      approvedBy: "teacher-1",
    });

    const result = await approveTaskBuildDraft("draft-1", "teacher-1");
    expect(result.status).toBe("approved");
    expect(prisma.taskBuildDraft.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: expect.objectContaining({
        status: "approved",
        approvedBy: "teacher-1",
        approvedAt: expect.any(Date),
      }),
    });
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "task_draft.approve",
        actorId: "teacher-1",
        targetId: "draft-1",
        targetType: "TaskBuildDraft",
        metadata: expect.objectContaining({ courseId: "course-1" }),
      }),
    );
  });

  it("rejects approving a draft that is not in ready state", async () => {
    mk(prisma.taskBuildDraft.findUnique).mockResolvedValue({
      id: "draft-2",
      status: "draft",
      courseId: "course-1",
      title: "未就绪草稿",
    });

    await expect(approveTaskBuildDraft("draft-2", "teacher-1")).rejects.toThrow(
      "TASK_BUILD_DRAFT_NOT_READY_FOR_APPROVAL",
    );
    expect(prisma.taskBuildDraft.update).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects approving when status is already approved (no double-approval)", async () => {
    mk(prisma.taskBuildDraft.findUnique).mockResolvedValue({
      id: "draft-3",
      status: "approved",
      courseId: "course-1",
      title: "已批准",
    });

    await expect(approveTaskBuildDraft("draft-3", "teacher-1")).rejects.toThrow(
      "TASK_BUILD_DRAFT_NOT_READY_FOR_APPROVAL",
    );
  });

  it("rejects approving when draft does not exist", async () => {
    mk(prisma.taskBuildDraft.findUnique).mockResolvedValue(null);
    await expect(approveTaskBuildDraft("missing", "teacher-1")).rejects.toThrow(
      "TASK_BUILD_DRAFT_NOT_FOUND",
    );
  });
});

describe("markTaskBuildDraftPublished", () => {
  it("transitions approved → published via conditional atomic update", async () => {
    mk(prisma.taskBuildDraft.update).mockResolvedValue({
      id: "draft-1",
      status: "published",
    });

    const r = await markTaskBuildDraftPublished("draft-1");
    expect(r.status).toBe("published");
    // Codex-P1-r4: conditional update — where 包含 status:"approved" 防并发竞态
    expect(prisma.taskBuildDraft.update).toHaveBeenCalledWith({
      where: { id: "draft-1", status: "approved" },
      data: { status: "published" },
    });
  });

  it("rejects publishing a non-approved draft (P2025 mapped to NOT_APPROVED)", async () => {
    // Prisma 找不到符合 where {id, status:"approved"} 的记录 → 抛 P2025
    const { Prisma } = await import("@prisma/client");
    mk(prisma.taskBuildDraft.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record to update not found", {
        code: "P2025",
        clientVersion: "x",
      }),
    );
    await expect(markTaskBuildDraftPublished("draft-2")).rejects.toThrow(
      "TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH",
    );
  });

  it("rejects publishing when draft does not exist (same error as non-approved)", async () => {
    const { Prisma } = await import("@prisma/client");
    mk(prisma.taskBuildDraft.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record to update not found", {
        code: "P2025",
        clientVersion: "x",
      }),
    );
    // Codex-P1-r4: 不区分"不存在 vs 状态变了"，race loser 和 not-found 都得到统一错误
    await expect(markTaskBuildDraftPublished("missing")).rejects.toThrow(
      "TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH",
    );
  });
});

describe("listTaskBuildDrafts with status filter", () => {
  it("filters by single status value", async () => {
    mk(prisma.taskBuildDraft.findMany).mockResolvedValue([]);
    await listTaskBuildDrafts("course-1", { status: "approved" });
    expect(prisma.taskBuildDraft.findMany).toHaveBeenCalledWith({
      where: { courseId: "course-1", status: "approved" },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  });

  it("filters by multiple status values (IN clause)", async () => {
    mk(prisma.taskBuildDraft.findMany).mockResolvedValue([]);
    await listTaskBuildDrafts("course-1", { status: ["ready", "approved"] });
    expect(prisma.taskBuildDraft.findMany).toHaveBeenCalledWith({
      where: { courseId: "course-1", status: { in: ["ready", "approved"] } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  });

  it("no filter returns all when no status passed", async () => {
    mk(prisma.taskBuildDraft.findMany).mockResolvedValue([]);
    await listTaskBuildDrafts("course-1");
    expect(prisma.taskBuildDraft.findMany).toHaveBeenCalledWith({
      where: { courseId: "course-1" },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  });
});
