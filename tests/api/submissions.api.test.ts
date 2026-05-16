/**
 * Route 三角 — Group 1: submissions mutation (8 routes × 3 case = 24 case)
 *
 * 覆盖:
 *   POST /api/submissions
 *   PATCH /api/submissions/[id]
 *   DELETE /api/submissions/[id]
 *   POST /api/submissions/[id]/grade
 *   POST /api/submissions/[id]/release
 *   POST /api/submissions/[id]/ungrade
 *   POST /api/submissions/[id]/retry-grade
 *   DELETE /api/submissions/batch
 *   POST /api/submissions/batch-release
 *
 * 每路由三角: 200 happy / 401 未登录 / 403 跨用户 (student↔teacher 或 跨班).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixtureUsers, mockAuthResult, mockAuthError } from "../_fixtures/users";
import { buildJsonRequest, makeRouteContext } from "../_fixtures/requests";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/resource-access", () => ({
  assertTaskInstanceReadable: vi.fn(),
  assertTaskReadable: vi.fn(),
  assertSubmissionReadable: vi.fn(),
}));

vi.mock("@/lib/services/submission.service", () => ({
  createSubmission: vi.fn(),
  getSubmissions: vi.fn(),
  getSubmissionById: vi.fn(),
  updateSubmissionGrade: vi.fn(),
  deleteSubmission: vi.fn(),
  batchDeleteSubmissions: vi.fn(),
  ungradeSubmission: vi.fn(),
  resetSubmissionForRetry: vi.fn(),
  stripSubmissionForStudent: vi.fn((s) => s),
  deriveAnalysisStatus: vi.fn(() => "graded"),
}));

vi.mock("@/lib/services/release.service", () => ({
  releaseSubmission: vi.fn(),
  unreleaseSubmission: vi.fn(),
  batchReleaseSubmissions: vi.fn(),
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
    submission: { findUnique: vi.fn() },
    taskInstance: { findUnique: vi.fn() },
  },
}));

import { requireAuth, requireRole } from "@/lib/auth/guards";
import {
  assertSubmissionReadable,
  assertTaskInstanceReadable,
  assertTaskReadable,
} from "@/lib/auth/resource-access";
import {
  createSubmission,
  getSubmissionById,
  updateSubmissionGrade,
  deleteSubmission,
  batchDeleteSubmissions,
  ungradeSubmission,
} from "@/lib/services/submission.service";
import {
  releaseSubmission,
  batchReleaseSubmissions,
} from "@/lib/services/release.service";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import { prisma } from "@/lib/db/prisma";

import { POST as createPOST } from "@/app/api/submissions/route";
import {
  GET as detailGET,
  DELETE as detailDELETE,
} from "@/app/api/submissions/[id]/route";
import { POST as gradePOST } from "@/app/api/submissions/[id]/grade/route";
import { POST as releasePOST } from "@/app/api/submissions/[id]/release/route";
import { POST as ungradePOST } from "@/app/api/submissions/[id]/ungrade/route";
import { POST as retryPOST } from "@/app/api/submissions/[id]/retry-grade/route";
import { DELETE as batchDELETE } from "@/app/api/submissions/batch/route";
import { POST as batchReleasePOST } from "@/app/api/submissions/batch-release/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const SUB_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const INST_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/submissions", () => {
  it("200: student 提交 simulation 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.studentA1));
    mk(assertTaskInstanceReadable).mockResolvedValue(undefined);
    mk(assertTaskReadable).mockResolvedValue(undefined);
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ taskId: TASK_ID, taskType: "simulation" });
    mk(createSubmission).mockResolvedValue({ id: SUB_ID, status: "submitted" });
    mk(enqueueAsyncJob).mockResolvedValue({ id: "job-1" });

    const req = buildJsonRequest("/api/submissions", "POST", {
      taskType: "simulation",
      taskId: TASK_ID,
      taskInstanceId: INST_ID,
      transcript: [{ id: "m1", role: "student", text: "hi", timestamp: new Date().toISOString() }],
    });
    const res = await createPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(SUB_ID);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录，请先登录"));
    const req = buildJsonRequest("/api/submissions", "POST", { taskType: "simulation" });
    const res = await createPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: teacher 不能提交 (角色守护)", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(403, "FORBIDDEN", "权限不足"));
    const req = buildJsonRequest("/api/submissions", "POST", { taskType: "simulation" });
    const res = await createPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/submissions/[id]", () => {
  it("200: teacher 看到自己学生的 submission", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertSubmissionReadable).mockResolvedValue(undefined);
    mk(getSubmissionById).mockResolvedValue({
      id: SUB_ID,
      score: 85,
      status: "graded",
      releasedAt: new Date(),
    });
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}`, "GET");
    const res = await detailGET(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(SUB_ID);
  });

  it("401: 未登录", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}`, "GET");
    const res = await detailGET(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 跨班 student 不能读其他班 submission", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentB1));
    mk(assertSubmissionReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}`, "GET");
    const res = await detailGET(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/submissions/[id]", () => {
  it("200: teacher 删自己学生的 submission", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertSubmissionReadable).mockResolvedValue(undefined);
    mk(deleteSubmission).mockResolvedValue(undefined);
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}`, "DELETE");
    const res = await detailDELETE(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.deleted).toBe(true);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}`, "DELETE");
    const res = await detailDELETE(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 跨教师不能删别人 submission", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertSubmissionReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}`, "DELETE");
    const res = await detailDELETE(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/submissions/[id]/grade", () => {
  it("200: teacher 手动 grade 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertSubmissionReadable).mockResolvedValue(undefined);
    mk(updateSubmissionGrade).mockResolvedValue({ id: SUB_ID, score: 85 });
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/grade`, "POST", {
      score: 85,
      maxScore: 100,
    });
    const res = await gradePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/grade`, "POST", { score: 1, maxScore: 1 });
    const res = await gradePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 creator/collab teacher 不能 grade", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertSubmissionReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/grade`, "POST", { score: 1, maxScore: 1 });
    const res = await gradePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/submissions/[id]/release", () => {
  it("200: teacher release 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(releaseSubmission).mockResolvedValue({ id: SUB_ID, releasedAt: new Date() });
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/release`, "POST", { released: true });
    const res = await releasePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/release`, "POST", { released: true });
    const res = await releasePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 release 被 service 拒", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(releaseSubmission).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/release`, "POST", { released: true });
    const res = await releasePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/submissions/[id]/ungrade", () => {
  it("200: teacher ungrade 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertSubmissionReadable).mockResolvedValue(undefined);
    mk(ungradeSubmission).mockResolvedValue(undefined);
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/ungrade`, "POST");
    const res = await ungradePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/ungrade`, "POST");
    const res = await ungradePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 ungrade 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertSubmissionReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/ungrade`, "POST");
    const res = await ungradePOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/submissions/[id]/retry-grade", () => {
  it("200: teacher retry-grade 触发 async-job", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertSubmissionReadable).mockResolvedValue(undefined);
    mk(getSubmissionById).mockResolvedValue({
      id: SUB_ID,
      status: "submitted",
      releasedAt: null,
    });
    mk(enqueueAsyncJob).mockResolvedValue({ id: "job-1", type: "submission_grade" });
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/retry-grade`, "POST");
    const res = await retryPOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/retry-grade`, "POST");
    const res = await retryPOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 retry-grade 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertSubmissionReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/submissions/${SUB_ID}/retry-grade`, "POST");
    const res = await retryPOST(req, makeRouteContext({ id: SUB_ID }));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/submissions/batch", () => {
  it("200: teacher 批量删 4 条", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(batchDeleteSubmissions).mockResolvedValue({ count: 4 });
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    const req = buildJsonRequest("/api/submissions/batch", "DELETE", { ids });
    const res = await batchDELETE(req);
    expect(res.status).toBe(200);
    expect((await res.json()).data.deleted).toBe(4);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/submissions/batch", "DELETE", { ids: [SUB_ID] });
    const res = await batchDELETE(req);
    expect(res.status).toBe(401);
  });

  it("403: student 不能 batch delete (role guard)", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(403, "FORBIDDEN", "权限不足"));
    const req = buildJsonRequest("/api/submissions/batch", "DELETE", { ids: [SUB_ID] });
    const res = await batchDELETE(req);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/submissions/batch-release", () => {
  it("200: teacher 批量 release 5 条", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(batchReleaseSubmissions).mockResolvedValue({ released: 5, skipped: 0 });
    const ids = Array.from({ length: 5 }, (_, i) => {
      const seg = i.toString().padStart(8, "0");
      return `${seg}-0000-4000-8000-000000000000`;
    });
    const req = buildJsonRequest("/api/submissions/batch-release", "POST", {
      submissionIds: ids,
      released: true,
    });
    const res = await batchReleasePOST(req);
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/submissions/batch-release", "POST", {
      submissionIds: [SUB_ID],
      released: true,
    });
    const res = await batchReleasePOST(req);
    expect(res.status).toBe(401);
  });

  it("403: student 角色守护 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(403, "FORBIDDEN", "权限不足"));
    const req = buildJsonRequest("/api/submissions/batch-release", "POST", {
      submissionIds: [SUB_ID],
      released: true,
    });
    const res = await batchReleasePOST(req);
    expect(res.status).toBe(403);
  });
});
