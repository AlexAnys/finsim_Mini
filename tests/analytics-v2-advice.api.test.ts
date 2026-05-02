import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    asyncJob: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/async-job.service", () => ({
  enqueueAsyncJob: vi.fn(),
}));

vi.mock("@/lib/services/analytics-v2.service", () => ({
  getAnalyticsV2Diagnosis: vi.fn(),
  buildDataInsightFingerprint: vi.fn(),
}));

import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { prisma } from "@/lib/db/prisma";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import {
  buildDataInsightFingerprint,
  getAnalyticsV2Diagnosis,
} from "@/lib/services/analytics-v2.service";
import { POST } from "@/app/api/lms/analytics-v2/advice/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function request(url: string) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lms/analytics-v2/advice", () => {
  it("returns role guard errors before reading analytics", async () => {
    mk(requireRole).mockResolvedValue({
      session: null,
      error: NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "权限不足" } },
        { status: 403 },
      ),
    });

    const res = await POST(
      request("http://localhost/api/lms/analytics-v2/advice?courseId=course-1") as Parameters<typeof POST>[0],
    );

    expect(res.status).toBe(403);
    expect(assertCourseAccess).not.toHaveBeenCalled();
    expect(getAnalyticsV2Diagnosis).not.toHaveBeenCalled();
  });

  it("returns cached advice when the fingerprint matches the latest succeeded job", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(getAnalyticsV2Diagnosis).mockResolvedValue({ scope: { courseId: "course-1" } });
    mk(buildDataInsightFingerprint).mockReturnValue("fp-1");
    mk(prisma.asyncJob.findMany).mockResolvedValue([
      {
        id: "job-1",
        status: "succeeded",
        result: {
          fingerprint: "fp-1",
          generatedAt: "2026-01-01T00:00:00.000Z",
          summary: "需要复盘 CAPM",
          knowledgeGoals: [],
          teachingMethods: [],
          focusGroups: [],
          nextActions: [],
          evidenceRefs: [],
        },
      },
    ]);

    const res = await POST(
      request(
        "http://localhost/api/lms/analytics-v2/advice?courseId=course-1&range=custom&dateFrom=2026-01-01&dateTo=2026-01-31&scoreBins=ten",
      ) as Parameters<typeof POST>[0],
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.cachedAdvice.summary).toBe("需要复盘 CAPM");
    expect(prisma.asyncJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "data_insight_advice",
          entityType: "DataInsightAdvice",
          entityId: "course-1",
          createdBy: "teacher-1",
          status: "succeeded",
        }),
      }),
    );
    expect(enqueueAsyncJob).not.toHaveBeenCalled();
  });

  it("enqueues an advice job when no cached fingerprint matches", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(getAnalyticsV2Diagnosis).mockResolvedValue({ scope: { courseId: "course-1" } });
    mk(buildDataInsightFingerprint).mockReturnValue("fp-2");
    mk(prisma.asyncJob.findMany).mockResolvedValue([]);
    mk(enqueueAsyncJob).mockResolvedValue({ id: "job-2", status: "queued" });

    const res = await POST(
      request("http://localhost/api/lms/analytics-v2/advice?courseId=course-1&taskType=quiz") as Parameters<typeof POST>[0],
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.job).toMatchObject({ id: "job-2", status: "queued" });
    expect(enqueueAsyncJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "data_insight_advice",
        entityType: "DataInsightAdvice",
        entityId: "course-1",
        createdBy: "teacher-1",
        input: expect.objectContaining({
          courseId: "course-1",
          taskType: "quiz",
          fingerprint: "fp-2",
        }),
      }),
    );
  });
});
