/**
 * Route 三角 — Group 2: tasks + task-instances mutation (8 routes × 3 = 24 case)
 *
 * 覆盖:
 *   POST /api/tasks
 *   PATCH /api/tasks/[id]
 *   DELETE /api/tasks/[id]
 *   POST /api/lms/task-instances
 *   PATCH /api/lms/task-instances/[id]
 *   DELETE /api/lms/task-instances/[id]
 *   PATCH /api/lms/task-instances/[id]/snapshot
 *   POST /api/lms/task-instances/[id]/publish
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixtureUsers, fixtureClasses, mockAuthResult, mockAuthError } from "../_fixtures/users";
import { buildJsonRequest, makeRouteContext } from "../_fixtures/requests";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/resource-access", () => ({
  assertTaskReadable: vi.fn(),
  assertTaskInstanceReadable: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/services/task.service", () => ({
  createTask: vi.fn(),
  getTaskById: vi.fn(),
  getTasksByCreator: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("@/lib/services/task-instance.service", () => ({
  createTaskInstance: vi.fn(),
  getTaskInstances: vi.fn(),
  getTaskInstanceById: vi.fn(),
  updateTaskInstance: vi.fn(),
  deleteTaskInstance: vi.fn(),
  publishTaskInstance: vi.fn(),
  updateTaskInstanceSnapshot: vi.fn(),
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
    taskInstance: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth/actor-role", () => ({
  getCourseActorRole: vi.fn().mockResolvedValue("owner"),
}));

import { requireRole } from "@/lib/auth/guards";
import { assertTaskReadable } from "@/lib/auth/resource-access";
import { assertCourseAccess } from "@/lib/auth/course-access";
import {
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/services/task.service";
import {
  createTaskInstance,
  updateTaskInstance,
  deleteTaskInstance,
  publishTaskInstance,
  updateTaskInstanceSnapshot,
} from "@/lib/services/task-instance.service";
import { prisma } from "@/lib/db/prisma";

import { POST as tasksPOST } from "@/app/api/tasks/route";
import {
  PATCH as tasksPATCH,
  DELETE as tasksDELETE,
} from "@/app/api/tasks/[id]/route";
import { POST as instPOST } from "@/app/api/lms/task-instances/route";
import {
  PATCH as instPATCH,
  DELETE as instDELETE,
} from "@/app/api/lms/task-instances/[id]/route";
import { PATCH as snapshotPATCH } from "@/app/api/lms/task-instances/[id]/snapshot/route";
import { POST as publishPOST } from "@/app/api/lms/task-instances/[id]/publish/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/tasks", () => {
  it("200: teacher 创建 quiz task 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(createTask).mockResolvedValue({ id: TASK_ID, taskType: "quiz" });
    const req = buildJsonRequest("/api/tasks", "POST", {
      taskType: "quiz",
      taskName: "测验1",
      quizConfig: { mode: "fixed", questionCount: 10, timeLimitMinutes: 30 },
    });
    const res = await tasksPOST(req);
    expect(res.status).toBe(201);
    expect((await res.json()).data.id).toBe(TASK_ID);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/tasks", "POST", {
      taskType: "quiz",
      taskName: "x",
    });
    const res = await tasksPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: student 触发角色守护 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(403, "FORBIDDEN", "权限不足"));
    const req = buildJsonRequest("/api/tasks", "POST", {
      taskType: "quiz",
      taskName: "x",
    });
    const res = await tasksPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/tasks/[id]", () => {
  it("200: owner teacher 修改成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(updateTask).mockResolvedValue({ id: TASK_ID, taskName: "改名" });
    const req = buildJsonRequest(`/api/tasks/${TASK_ID}`, "PATCH", {
      taskName: "改名",
    });
    const res = await tasksPATCH(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/tasks/${TASK_ID}`, "PATCH", { taskName: "x" });
    const res = await tasksPATCH(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 service 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(updateTask).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/tasks/${TASK_ID}`, "PATCH", { taskName: "x" });
    const res = await tasksPATCH(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/tasks/[id]", () => {
  it("200: owner teacher 删除成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(deleteTask).mockResolvedValue(undefined);
    const req = buildJsonRequest(`/api/tasks/${TASK_ID}`, "DELETE");
    const res = await tasksDELETE(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/tasks/${TASK_ID}`, "DELETE");
    const res = await tasksDELETE(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(deleteTask).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/tasks/${TASK_ID}`, "DELETE");
    const res = await tasksDELETE(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/lms/task-instances", () => {
  it("200: teacher 创建 instance 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertTaskReadable).mockResolvedValue(undefined);
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(prisma.course.findUnique).mockResolvedValue({
      classId: fixtureClasses.classA.id,
      classes: [],
    });
    mk(createTaskInstance).mockResolvedValue({ id: INST_ID, status: "draft" });
    const req = buildJsonRequest("/api/lms/task-instances", "POST", {
      title: "实例1",
      taskId: TASK_ID,
      taskType: "quiz",
      classId: fixtureClasses.classA.id,
      courseId: COURSE_ID,
      dueAt: "2026-12-31T00:00:00.000Z",
    });
    const res = await instPOST(req);
    expect(res.status).toBe(201);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/lms/task-instances", "POST", {
      title: "x",
      taskId: TASK_ID,
      taskType: "quiz",
      classId: fixtureClasses.classA.id,
      dueAt: "2026-12-31T00:00:00.000Z",
    });
    const res = await instPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: 跨班 — teacher 试图创建他人 class 的 instance", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertTaskReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest("/api/lms/task-instances", "POST", {
      title: "x",
      taskId: TASK_ID,
      taskType: "quiz",
      classId: fixtureClasses.classB.id,
      dueAt: "2026-12-31T00:00:00.000Z",
    });
    const res = await instPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/lms/task-instances/[id]", () => {
  it("200: owner teacher 修改 instance 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(updateTaskInstance).mockResolvedValue({ id: INST_ID, title: "改名" });
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}`, "PATCH", {
      title: "改名",
    });
    const res = await instPATCH(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}`, "PATCH", { title: "x" });
    const res = await instPATCH(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 service 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(updateTaskInstance).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}`, "PATCH", { title: "x" });
    const res = await instPATCH(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/lms/task-instances/[id]", () => {
  it("200: owner teacher 删除 instance", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(deleteTaskInstance).mockResolvedValue(undefined);
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}`, "DELETE");
    const res = await instDELETE(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}`, "DELETE");
    const res = await instDELETE(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 删 instance 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(deleteTaskInstance).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}`, "DELETE");
    const res = await instDELETE(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/lms/task-instances/[id]/snapshot", () => {
  it("200: owner teacher 改 snapshot 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(updateTaskInstanceSnapshot).mockResolvedValue({
      instance: { id: INST_ID },
      gradedCount: 0,
    });
    const req = buildJsonRequest(
      `/api/lms/task-instances/${INST_ID}/snapshot`,
      "PATCH",
      {
        taskType: "subjective",
        subjectiveConfig: { wordLimit: 200, allowedAttachmentTypes: [] },
      },
    );
    const res = await snapshotPATCH(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(
      `/api/lms/task-instances/${INST_ID}/snapshot`,
      "PATCH",
      { taskType: "subjective" },
    );
    const res = await snapshotPATCH(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 service 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(updateTaskInstanceSnapshot).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(
      `/api/lms/task-instances/${INST_ID}/snapshot`,
      "PATCH",
      { taskType: "subjective" },
    );
    const res = await snapshotPATCH(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/lms/task-instances/[id]/publish", () => {
  it("200: owner teacher publish 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(publishTaskInstance).mockResolvedValue({ id: INST_ID, status: "published" });
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ courseId: COURSE_ID });
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}/publish`, "POST");
    const res = await publishPOST(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}/publish`, "POST");
    const res = await publishPOST(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher publish 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(publishTaskInstance).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/lms/task-instances/${INST_ID}/publish`, "POST");
    const res = await publishPOST(req, makeRouteContext({ id: INST_ID }));
    expect(res.status).toBe(403);
  });
});
