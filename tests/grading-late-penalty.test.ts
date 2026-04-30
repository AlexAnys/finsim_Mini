import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/services/ai.service", () => ({}));
vi.mock("@/lib/services/submission.service", () => ({ updateSubmissionGrade: vi.fn() }));
vi.mock("@/lib/services/audit.service", () => ({ logAudit: vi.fn() }));

import { computeLatePenalty } from "@/lib/services/grading.service";

describe("computeLatePenalty", () => {
  it("keeps on-time scores unchanged", () => {
    const result = computeLatePenalty({
      score: 90,
      maxScore: 100,
      dueAt: "2026-04-30T12:00:00.000Z",
      submittedAt: "2026-04-30T11:59:00.000Z",
    });

    expect(result.applied).toBe(false);
    expect(result.score).toBe(90);
    expect(result.penaltyAmount).toBe(0);
  });

  it("applies the default 20 percent penalty after due time", () => {
    const result = computeLatePenalty({
      score: 87.5,
      maxScore: 100,
      dueAt: "2026-04-30T12:00:00.000Z",
      submittedAt: "2026-04-30T12:01:00.000Z",
    });

    expect(result.applied).toBe(true);
    expect(result.originalScore).toBe(87.5);
    expect(result.penaltyAmount).toBe(17.5);
    expect(result.score).toBe(70);
  });

  it("does not create negative scores", () => {
    const result = computeLatePenalty({
      score: 0,
      maxScore: 100,
      dueAt: "2026-04-30T12:00:00.000Z",
      submittedAt: "2026-04-30T12:01:00.000Z",
    });

    expect(result.applied).toBe(false);
    expect(result.score).toBe(0);
  });
});
