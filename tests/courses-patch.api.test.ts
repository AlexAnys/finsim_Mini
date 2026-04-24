import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/guards", async () => {
  // Use the real assertCourseAccess (pure — only touches @/lib/db/prisma which we mock below).
  const courseAccess = await vi.importActual<typeof import("@/lib/auth/course-access")>(
    "@/lib/auth/course-access"
  );
  return {
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    assertCourseAccess: courseAccess.assertCourseAccess,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: vi.fn(), update: vi.fn() },
    courseTeacher: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/services/course.service", () => ({
  getCourseWithStructure: vi.fn(),
}));

import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { PATCH } from "@/app/api/lms/courses/[id]/route";

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/lms/courses/course-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/lms/courses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when a non-owner, non-collaborator teacher calls PATCH", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { user: { id: "teacher-other", role: "teacher" } },
      error: null,
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });
    (prisma.courseTeacher.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = buildRequest({ courseTitle: "Hacked" });
    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "course-1" }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it("rejects classId in the request body via zod validation (field removed from schema)", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { user: { id: "teacher-owner", role: "teacher" } },
      error: null,
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });

    const req = buildRequest({ classId: "00000000-0000-0000-0000-000000000000" });
    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "course-1" }),
    });

    // With classId removed from schema, the body has no allowed fields -> refine fails
    expect(res.status).toBe(400);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it("updates course when owner calls PATCH with a valid field", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { user: { id: "teacher-owner", role: "teacher" } },
      error: null,
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      createdBy: "teacher-owner",
    });
    (prisma.course.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      courseTitle: "New Title",
    });

    const req = buildRequest({ courseTitle: "New Title" });
    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "course-1" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: "course-1" },
      data: { courseTitle: "New Title" },
    });
  });

  it("allows admin without ownership check", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
      error: null,
    });
    (prisma.course.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "course-1",
      courseTitle: "Admin Updated",
    });

    const req = buildRequest({ courseTitle: "Admin Updated" });
    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "course-1" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
    expect(prisma.course.update).toHaveBeenCalled();
  });
});
