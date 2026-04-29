import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/services/analytics-v2.service", () => ({
  getAnalyticsV2Diagnosis: vi.fn(),
}));

import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { getAnalyticsV2Diagnosis } from "@/lib/services/analytics-v2.service";
import { GET } from "@/app/api/lms/analytics-v2/diagnosis/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function request(url: string) {
  return new Request(url, { headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/lms/analytics-v2/diagnosis", () => {
  it("requires teacher/admin role and courseId", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });

    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/diagnosis") as Parameters<typeof GET>[0],
    );

    expect(requireRole).toHaveBeenCalledWith(["teacher", "admin"]);
    expect(res.status).toBe(400);
    expect(assertCourseAccess).not.toHaveBeenCalled();
    expect(getAnalyticsV2Diagnosis).not.toHaveBeenCalled();
  });

  it("returns role guard errors before reading analytics", async () => {
    mk(requireRole).mockResolvedValue({
      session: null,
      error: NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "权限不足" } },
        { status: 403 },
      ),
    });

    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/diagnosis?courseId=course-1") as Parameters<typeof GET>[0],
    );

    expect(res.status).toBe(403);
    expect(assertCourseAccess).not.toHaveBeenCalled();
    expect(getAnalyticsV2Diagnosis).not.toHaveBeenCalled();
  });

  it("checks course access and forwards validated filters", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(getAnalyticsV2Diagnosis).mockResolvedValue({ scope: { courseId: "course-1" } });

    const res = await GET(
      request(
        "http://localhost/api/lms/analytics-v2/diagnosis?courseId=course-1&classId=class-A&taskType=quiz&scorePolicy=best&range=30d",
      ) as Parameters<typeof GET>[0],
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(assertCourseAccess).toHaveBeenCalledWith("course-1", "teacher-1", "teacher");
    expect(getAnalyticsV2Diagnosis).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: "course-1",
        classId: "class-A",
        taskType: "quiz",
        scorePolicy: "best",
        range: "30d",
      }),
    );
  });

  it("rejects invalid enum query values before course access", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });

    const res = await GET(
      request(
        "http://localhost/api/lms/analytics-v2/diagnosis?courseId=course-1&scorePolicy=median",
      ) as Parameters<typeof GET>[0],
    );

    expect(res.status).toBe(400);
    expect(assertCourseAccess).not.toHaveBeenCalled();
    expect(getAnalyticsV2Diagnosis).not.toHaveBeenCalled();
  });
});
