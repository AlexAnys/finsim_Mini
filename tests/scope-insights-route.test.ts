import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/services/scope-insights.service", () => ({
  getScopeSimulationInsights: vi.fn(),
  getScopeStudyBuddySummary: vi.fn(),
  getScopeTeachingAdvice: vi.fn(),
}));

import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import {
  getScopeSimulationInsights,
  getScopeStudyBuddySummary,
  getScopeTeachingAdvice,
} from "@/lib/services/scope-insights.service";
import { GET, POST } from "@/app/api/lms/analytics-v2/scope-insights/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function request(url: string) {
  return new Request(url, { headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mk(assertCourseAccess).mockResolvedValue(undefined);
});

describe("GET /api/lms/analytics-v2/scope-insights", () => {
  it("requires teacher/admin role", async () => {
    mk(requireRole).mockResolvedValue({
      session: null,
      error: NextResponse.json({ success: false }, { status: 401 }),
    });

    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/scope-insights?courseId=c-1") as Parameters<typeof GET>[0],
    );

    expect(requireRole).toHaveBeenCalledWith(["teacher", "admin"]);
    expect(res.status).toBe(401);
    expect(getScopeSimulationInsights).not.toHaveBeenCalled();
  });

  it("returns 400 when courseId missing", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "t-1", role: "teacher" } },
      error: null,
    });

    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/scope-insights") as Parameters<typeof GET>[0],
    );

    expect(res.status).toBe(400);
    expect(getScopeSimulationInsights).not.toHaveBeenCalled();
  });

  it("returns 200 with simulation/studyBuddy/teachingAdvice on success", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "t-1", role: "teacher" } },
      error: null,
    });
    mk(getScopeSimulationInsights).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      highlights: [],
      commonIssues: [],
      source: "fresh",
    });
    mk(getScopeStudyBuddySummary).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      bySection: [],
    });
    mk(getScopeTeachingAdvice).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      source: "fresh",
      knowledgeGoals: [],
      pedagogyAdvice: [],
      focusGroups: [],
      nextSteps: [],
    });

    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/scope-insights?courseId=c-1") as Parameters<typeof GET>[0],
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("simulation");
    expect(body.data).toHaveProperty("studyBuddy");
    expect(body.data).toHaveProperty("teachingAdvice");
    expect(getScopeSimulationInsights).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "c-1" }),
      { teacherId: "t-1" },
    );
  });

  it("forwards classIds (multi) to service scope", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "t-1", role: "teacher" } },
      error: null,
    });
    mk(getScopeSimulationInsights).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      highlights: [],
      commonIssues: [],
      source: "fresh",
    });
    mk(getScopeStudyBuddySummary).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      bySection: [],
    });
    mk(getScopeTeachingAdvice).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      source: "fresh",
      knowledgeGoals: [],
      pedagogyAdvice: [],
      focusGroups: [],
      nextSteps: [],
    });

    await GET(
      request("http://localhost/api/lms/analytics-v2/scope-insights?courseId=c-1&classIds=A&classIds=B") as Parameters<typeof GET>[0],
    );
    expect(getScopeSimulationInsights).toHaveBeenCalledWith(
      expect.objectContaining({ classIds: ["A", "B"] }),
      expect.anything(),
    );
  });

  it("supports legacy classId fallback when classIds missing", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "t-1", role: "teacher" } },
      error: null,
    });
    mk(getScopeSimulationInsights).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      highlights: [],
      commonIssues: [],
      source: "fresh",
    });
    mk(getScopeStudyBuddySummary).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      bySection: [],
    });
    mk(getScopeTeachingAdvice).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      source: "fresh",
      knowledgeGoals: [],
      pedagogyAdvice: [],
      focusGroups: [],
      nextSteps: [],
    });

    await GET(
      request("http://localhost/api/lms/analytics-v2/scope-insights?courseId=c-1&classId=L") as Parameters<typeof GET>[0],
    );
    expect(getScopeSimulationInsights).toHaveBeenCalledWith(
      expect.objectContaining({ classIds: ["L"] }),
      expect.anything(),
    );
  });

  it("rejects unknown taskType", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "t-1", role: "teacher" } },
      error: null,
    });
    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/scope-insights?courseId=c-1&taskType=unknown") as Parameters<typeof GET>[0],
    );
    expect(res.status).toBe(400);
    expect(getScopeSimulationInsights).not.toHaveBeenCalled();
  });
});

describe("POST /api/lms/analytics-v2/scope-insights", () => {
  it("requires teacher/admin role", async () => {
    mk(requireRole).mockResolvedValue({
      session: null,
      error: NextResponse.json({ success: false }, { status: 403 }),
    });

    const res = await POST(
      request("http://localhost/api/lms/analytics-v2/scope-insights?courseId=c-1") as Parameters<typeof POST>[0],
    );
    expect(res.status).toBe(403);
    expect(getScopeSimulationInsights).not.toHaveBeenCalled();
  });

  it("invokes simulation/studyBuddy/teachingAdvice with forceFresh on POST", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "t-1", role: "teacher" } },
      error: null,
    });
    mk(getScopeSimulationInsights).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      highlights: [],
      commonIssues: [],
      source: "fresh",
    });
    mk(getScopeStudyBuddySummary).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      bySection: [],
    });
    mk(getScopeTeachingAdvice).mockResolvedValue({
      scope: { courseId: "c-1" },
      generatedAt: "2026-05-03T00:00:00Z",
      source: "fresh",
      knowledgeGoals: [],
      pedagogyAdvice: [],
      focusGroups: [],
      nextSteps: [],
    });

    const res = await POST(
      request("http://localhost/api/lms/analytics-v2/scope-insights?courseId=c-1") as Parameters<typeof POST>[0],
    );
    expect(res.status).toBe(200);
    expect(getScopeSimulationInsights).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "c-1" }),
      expect.objectContaining({ forceFresh: true }),
    );
    expect(getScopeTeachingAdvice).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "c-1" }),
      expect.objectContaining({ forceFresh: true }),
    );
  });
});
