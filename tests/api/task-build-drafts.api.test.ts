/**
 * Route 三角 — Group 3: task-build-drafts (4 routes × 3 = 12 case)
 *
 * 覆盖:
 *   POST /api/lms/task-build-drafts
 *   PATCH /api/lms/task-build-drafts/[id]
 *   PATCH /api/lms/task-build-drafts/[id]/approve (existing tests/task-build-drafts-approve.api.test.ts 部分覆盖, 这里补)
 *   POST /api/lms/task-instances/with-task (atomic publish, codex-r4 主战场)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixtureUsers, fixtureClasses, mockAuthResult, mockAuthError } from "../_fixtures/users";
import { buildJsonRequest, makeRouteContext } from "../_fixtures/requests";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
  assertCourseNotArchived: vi.fn(),
}));

vi.mock("@/lib/services/task-build-draft.service", () => ({
  createTaskBuildDraft: vi.fn(),
  listTaskBuildDrafts: vi.fn(),
  getTaskBuildDraft: vi.fn(),
  updateTaskBuildDraft: vi.fn(),
  deleteTaskBuildDraft: vi.fn(),
  approveTaskBuildDraft: vi.fn(),
  markTaskBuildDraftPublished: vi.fn(),
}));

vi.mock("@/lib/services/task-instance.service", () => ({
  createPublishedTaskWithInstance: vi.fn(),
  createPublishedTaskWithInstanceInTransaction: vi.fn(),
}));

vi.mock("@/lib/services/async-job.service", () => ({
  enqueueAsyncJob: vi.fn(),
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/auth/actor-role", () => ({
  getCourseActorRole: vi.fn().mockResolvedValue("owner"),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: unknown) => {
      if (typeof cb === "function") return (cb as (tx: unknown) => unknown)({});
      return undefined;
    }),
  },
}));

import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import {
  createTaskBuildDraft,
  getTaskBuildDraft,
  updateTaskBuildDraft,
  approveTaskBuildDraft,
} from "@/lib/services/task-build-draft.service";
import { prisma } from "@/lib/db/prisma";
import { createPublishedTaskWithInstance } from "@/lib/services/task-instance.service";

import { POST as draftsPOST } from "@/app/api/lms/task-build-drafts/route";
import { PATCH as draftPATCH } from "@/app/api/lms/task-build-drafts/[id]/route";
import { PATCH as approvePATCH } from "@/app/api/lms/task-build-drafts/[id]/approve/route";
import { POST as withTaskPOST } from "@/app/api/lms/task-instances/with-task/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const DRAFT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lms/task-build-drafts", () => {
  it("200: teacher 创建 draft 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(createTaskBuildDraft).mockResolvedValue({ id: DRAFT_ID, status: "draft" });
    const req = buildJsonRequest("/api/lms/task-build-drafts", "POST", {
      courseId: COURSE_ID,
      taskType: "quiz",
    });
    const res = await draftsPOST(req);
    expect(res.status).toBe(201);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/lms/task-build-drafts", "POST", {
      courseId: COURSE_ID,
      taskType: "quiz",
    });
    const res = await draftsPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: 跨课程 — 非协作 teacher 触 assertCourseAccess 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertCourseAccess).mockRejectedValue(new Error("COURSE_ACCESS_DENIED"));
    const req = buildJsonRequest("/api/lms/task-build-drafts", "POST", {
      courseId: COURSE_ID,
      taskType: "quiz",
    });
    const res = await draftsPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/lms/task-build-drafts/[id]", () => {
  it("200: owner teacher 修改 draft 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(getTaskBuildDraft).mockResolvedValue({ id: DRAFT_ID, courseId: COURSE_ID });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(updateTaskBuildDraft).mockResolvedValue({ id: DRAFT_ID, title: "改名" });
    const req = buildJsonRequest(`/api/lms/task-build-drafts/${DRAFT_ID}`, "PATCH", {
      title: "改名",
    });
    const res = await draftPATCH(req, makeRouteContext({ id: DRAFT_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/task-build-drafts/${DRAFT_ID}`, "PATCH", { title: "x" });
    const res = await draftPATCH(req, makeRouteContext({ id: DRAFT_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 跨课程 teacher 触 assertCourseAccess 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(getTaskBuildDraft).mockResolvedValue({ id: DRAFT_ID, courseId: COURSE_ID });
    mk(assertCourseAccess).mockRejectedValue(new Error("COURSE_ACCESS_DENIED"));
    const req = buildJsonRequest(`/api/lms/task-build-drafts/${DRAFT_ID}`, "PATCH", { title: "x" });
    const res = await draftPATCH(req, makeRouteContext({ id: DRAFT_ID }));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/lms/task-build-drafts/[id]/approve", () => {
  it("200: owner teacher approve 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(getTaskBuildDraft).mockResolvedValue({ id: DRAFT_ID, courseId: COURSE_ID });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(approveTaskBuildDraft).mockResolvedValue({ id: DRAFT_ID, status: "approved" });
    const req = buildJsonRequest(
      `/api/lms/task-build-drafts/${DRAFT_ID}/approve`,
      "PATCH",
    );
    const res = await approvePATCH(req, makeRouteContext({ id: DRAFT_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/task-build-drafts/${DRAFT_ID}/approve`, "PATCH");
    const res = await approvePATCH(req, makeRouteContext({ id: DRAFT_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 跨课程 teacher 触 assertCourseAccess 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(getTaskBuildDraft).mockResolvedValue({ id: DRAFT_ID, courseId: COURSE_ID });
    mk(assertCourseAccess).mockRejectedValue(new Error("COURSE_ACCESS_DENIED"));
    const req = buildJsonRequest(`/api/lms/task-build-drafts/${DRAFT_ID}/approve`, "PATCH");
    const res = await approvePATCH(req, makeRouteContext({ id: DRAFT_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/lms/task-instances/with-task (atomic publish)", () => {
  it("200: owner teacher 原子 publish 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(prisma.course.findUnique).mockResolvedValue({
      classes: [{ classId: fixtureClasses.classA.id }],
    });
    mk(createPublishedTaskWithInstance).mockResolvedValue({
      instance: { id: "inst-1", taskId: TASK_ID },
      task: { id: TASK_ID },
    });
    const req = buildJsonRequest("/api/lms/task-instances/with-task", "POST", {
      task: {
        taskType: "quiz",
        taskName: "原子 publish 测试",
        quizConfig: { mode: "fixed", questionCount: 10 },
      },
      instance: {
        title: "实例",
        classId: fixtureClasses.classA.id,
        courseId: COURSE_ID,
        dueAt: "2026-12-31T00:00:00.000Z",
      },
    });
    const res = await withTaskPOST(req);
    expect(res.status).toBe(201);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/lms/task-instances/with-task", "POST", {
      task: { taskType: "quiz", taskName: "x" },
      instance: {
        title: "x",
        classId: fixtureClasses.classA.id,
        courseId: COURSE_ID,
        dueAt: "2026-12-31T00:00:00.000Z",
      },
    });
    const res = await withTaskPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: 跨课程 teacher 触 assertCourseAccess 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertCourseAccess).mockRejectedValue(new Error("COURSE_ACCESS_DENIED"));
    const req = buildJsonRequest("/api/lms/task-instances/with-task", "POST", {
      task: { taskType: "quiz", taskName: "x" },
      instance: {
        title: "x",
        classId: fixtureClasses.classA.id,
        courseId: COURSE_ID,
        dueAt: "2026-12-31T00:00:00.000Z",
      },
    });
    const res = await withTaskPOST(req);
    expect(res.status).toBe(403);
  });
});
