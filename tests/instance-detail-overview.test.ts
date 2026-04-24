import { describe, it, expect } from "vitest";
import {
  buildFunnel,
  formatCountdown,
  pctLabel,
} from "@/components/instance-detail/overview-utils";

describe("pctLabel", () => {
  it("rounds to integer percent", () => {
    expect(pctLabel(0.8267)).toBe("83%");
    expect(pctLabel(0)).toBe("0%");
    expect(pctLabel(1)).toBe("100%");
  });

  it("handles NaN and Infinity gracefully", () => {
    expect(pctLabel(NaN)).toBe("0%");
    expect(pctLabel(Infinity)).toBe("0%");
  });
});

describe("buildFunnel", () => {
  it("builds 4 entries in correct order", () => {
    const funnel = buildFunnel({ assigned: 82, submitted: 68, grading: 5, graded: 51 });
    expect(funnel).toHaveLength(4);
    expect(funnel.map((f) => f.key)).toEqual([
      "assigned",
      "submitted",
      "grading",
      "graded",
    ]);
  });

  it("computes submission rate from submitted/assigned", () => {
    const funnel = buildFunnel({ assigned: 100, submitted: 75, grading: 0, graded: 0 });
    const submitted = funnel.find((f) => f.key === "submitted")!;
    expect(submitted.pct).toBeCloseTo(0.75);
    expect(submitted.sub).toContain("75%");
  });

  it("computes graded rate from graded/submitted (not /assigned)", () => {
    const funnel = buildFunnel({ assigned: 100, submitted: 50, grading: 0, graded: 25 });
    const graded = funnel.find((f) => f.key === "graded")!;
    expect(graded.pct).toBeCloseTo(0.5);
    expect(graded.sub).toContain("50%");
  });

  it("handles zero-assigned and zero-submitted without div-by-zero", () => {
    const funnel = buildFunnel({ assigned: 0, submitted: 0, grading: 0, graded: 0 });
    for (const f of funnel) {
      expect(Number.isFinite(f.pct)).toBe(true);
    }
    expect(funnel.find((f) => f.key === "submitted")!.sub).toBe("0% 到交率");
    expect(funnel.find((f) => f.key === "graded")!.sub).toBe("0% 完成批改");
  });

  it("assigned entry is always 100%", () => {
    const funnel = buildFunnel({ assigned: 82, submitted: 68, grading: 5, graded: 51 });
    expect(funnel[0].pct).toBe(1);
  });
});

describe("formatCountdown", () => {
  const NOW = new Date("2026-04-23T12:00:00Z").getTime();

  it("returns '-' for invalid date", () => {
    const r = formatCountdown("not-a-date", NOW);
    expect(r.text).toBe("-");
    expect(r.tone).toBe("ink");
  });

  it("returns '已截止' when past due", () => {
    const past = new Date(NOW - 1000).toISOString();
    const r = formatCountdown(past, NOW);
    expect(r.text).toBe("已截止");
    expect(r.tone).toBe("danger");
  });

  it("returns hours/minutes when within 24h (warn tone)", () => {
    const soon = new Date(NOW + 2.5 * 3600000).toISOString();
    const r = formatCountdown(soon, NOW);
    expect(r.text).toMatch(/剩余 2 小时 30 分钟/);
    expect(r.tone).toBe("warn");
  });

  it("returns days in warn tone when < 3 days", () => {
    const soon = new Date(NOW + 2 * 86400000).toISOString();
    const r = formatCountdown(soon, NOW);
    expect(r.text).toBe("剩余 2 天");
    expect(r.tone).toBe("warn");
  });

  it("returns days in ink tone when >= 3 days", () => {
    const far = new Date(NOW + 5 * 86400000).toISOString();
    const r = formatCountdown(far, NOW);
    expect(r.text).toBe("剩余 5 天");
    expect(r.tone).toBe("ink");
  });
});
