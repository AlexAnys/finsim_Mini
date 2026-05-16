/**
 * Route 三角 — Group 4b: courses + teachers (3 routes × 3 = 9 case)
 *
 * 覆盖:
 *   POST /api/lms/courses
 *   POST /api/lms/courses/[id]/teachers (add collab)
 *   POST /api/lms/courses/[id]/classes (CourseClass M:N 新增)
 *
 * 注: PATCH /api/lms/courses/[id] 已在 tests/courses-patch.api.test.ts 覆盖 — 不重复.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixtureUsers, fixtureClasses, mockAuthResult, mockAuthError } from "../_fixtures/users";
import { buildJsonRequest, makeRouteContext } from "../_fixtures/requests";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/auth/actor-role", () => ({
  getCourseActorRole: vi.fn().mockResolvedValue("owner"),
}));

vi.mock("@/lib/services/course.service", () => ({
  createCourse: vi.fn(),
  getCoursesByTeacher: vi.fn(),
  getCoursesByClass: vi.fn(),
  getCourseTeachers: vi.fn(),
  addCourseTeacher: vi.fn(),
  removeCourseTeacher: vi.fn(),
  getCourseClasses: vi.fn(),
  addCourseClass: vi.fn(),
  removeCourseClass: vi.fn(),
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn() },
  },
}));

import { requireRole, assertCourseAccess as assertCourseAccessFromGuards } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import {
  createCourse,
  addCourseTeacher,
  addCourseClass,
} from "@/lib/services/course.service";
import { prisma } from "@/lib/db/prisma";

import { POST as coursesPOST } from "@/app/api/lms/courses/route";
import { POST as teachersPOST } from "@/app/api/lms/courses/[id]/teachers/route";
import { POST as classesPOST } from "@/app/api/lms/courses/[id]/classes/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lms/courses", () => {
  it("200: teacher 创建 course 成功", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(createCourse).mockResolvedValue({ id: COURSE_ID, courseTitle: "新课程" });
    const req = buildJsonRequest("/api/lms/courses", "POST", {
      courseTitle: "新课程",
      classId: fixtureClasses.classA.id,
    });
    const res = await coursesPOST(req);
    expect(res.status).toBe(201);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/lms/courses", "POST", {
      courseTitle: "x",
      classId: fixtureClasses.classA.id,
    });
    const res = await coursesPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: student 角色守护 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(403, "FORBIDDEN", "权限不足"));
    const req = buildJsonRequest("/api/lms/courses", "POST", {
      courseTitle: "x",
      classId: fixtureClasses.classA.id,
    });
    const res = await coursesPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/lms/courses/[id]/teachers (add collab)", () => {
  it("200: course owner 加 collab teacher", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(prisma.course.findUnique).mockResolvedValue({
      id: COURSE_ID,
      createdBy: fixtureUsers.teacher1.id,
    });
    mk(addCourseTeacher).mockResolvedValue({
      id: "ct-1",
      teacherId: fixtureUsers.teacher2.id,
    });
    const req = buildJsonRequest(
      `/api/lms/courses/${COURSE_ID}/teachers`,
      "POST",
      { email: fixtureUsers.teacher2.email },
    );
    const res = await teachersPOST(req, makeRouteContext({ id: COURSE_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/courses/${COURSE_ID}/teachers`, "POST", {
      email: fixtureUsers.teacher2.email,
    });
    const res = await teachersPOST(req, makeRouteContext({ id: COURSE_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 加 collab → assertCourseOwnerOrAdmin 拒", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(prisma.course.findUnique).mockResolvedValue({
      id: COURSE_ID,
      createdBy: fixtureUsers.teacher1.id,
    });
    const req = buildJsonRequest(`/api/lms/courses/${COURSE_ID}/teachers`, "POST", {
      email: fixtureUsers.teacher2.email,
    });
    const res = await teachersPOST(req, makeRouteContext({ id: COURSE_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/lms/courses/[id]/classes", () => {
  it("200: course owner 加 class 关联", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertCourseAccessFromGuards).mockResolvedValue(undefined);
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(addCourseClass).mockResolvedValue({
      courseId: COURSE_ID,
      classId: fixtureClasses.classB.id,
    });
    const req = buildJsonRequest(`/api/lms/courses/${COURSE_ID}/classes`, "POST", {
      classId: fixtureClasses.classB.id,
    });
    const res = await classesPOST(req, makeRouteContext({ id: COURSE_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/courses/${COURSE_ID}/classes`, "POST", {
      classId: fixtureClasses.classB.id,
    });
    const res = await classesPOST(req, makeRouteContext({ id: COURSE_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非协作 teacher 触 assertCourseAccess 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertCourseAccessFromGuards).mockRejectedValue(new Error("COURSE_ACCESS_DENIED"));
    mk(assertCourseAccess).mockRejectedValue(new Error("COURSE_ACCESS_DENIED"));
    const req = buildJsonRequest(`/api/lms/courses/${COURSE_ID}/classes`, "POST", {
      classId: fixtureClasses.classB.id,
    });
    const res = await classesPOST(req, makeRouteContext({ id: COURSE_ID }));
    expect(res.status).toBe(403);
  });
});
