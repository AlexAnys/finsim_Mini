import type { NormalizedSubmission } from "./submissions-utils";

export interface AnalyticsKPIs {
  avgScore: number | null;
  medianScore: number | null;
  passRate: number | null;
  avgDurationSeconds: number | null;
  gradedCount: number;
}

export interface HistogramBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ScatterPoint {
  submissionId: string;
  studentName: string;
  durationMinutes: number;
  score: number;
}

const PASS_RATIO = 0.6; // ≥ 60% of maxScore is "pass"

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeKPIs(rows: NormalizedSubmission[]): AnalyticsKPIs {
  const graded = rows.filter(
    (r) => r.status === "graded" && r.score !== null
  );
  if (graded.length === 0) {
    return {
      avgScore: null,
      medianScore: null,
      passRate: null,
      avgDurationSeconds: null,
      gradedCount: 0,
    };
  }

  const scores = graded.map((r) => r.score as number);
  const avgScore =
    Math.round(
      (scores.reduce((sum, s) => sum + s, 0) / graded.length) * 10
    ) / 10;
  const medScore = median(scores);
  const medianScore = medScore !== null ? Math.round(medScore * 10) / 10 : null;

  const passes = graded.filter((r) => {
    const max = r.maxScore ?? 100;
    if (max <= 0) return false;
    return (r.score as number) / max >= PASS_RATIO;
  }).length;
  const passRate = graded.length > 0 ? passes / graded.length : null;

  const durations = graded
    .map((r) => r.durationSeconds)
    .filter((v): v is number => v != null && isFinite(v) && v > 0);
  const avgDurationSeconds =
    durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null;

  return {
    avgScore,
    medianScore,
    passRate,
    avgDurationSeconds,
    gradedCount: graded.length,
  };
}

/**
 * Builds 6 buckets normalized to 0–100 (out of maxScore). Matches spec PR-5D
 * "得分分布直方图（6 档）".
 */
export function buildHistogram(
  rows: NormalizedSubmission[]
): HistogramBucket[] {
  const buckets: HistogramBucket[] = [
    { label: "<40", min: 0, max: 40, count: 0 },
    { label: "40-55", min: 40, max: 55, count: 0 },
    { label: "55-70", min: 55, max: 70, count: 0 },
    { label: "70-80", min: 70, max: 80, count: 0 },
    { label: "80-90", min: 80, max: 90, count: 0 },
    { label: "90+", min: 90, max: 101, count: 0 },
  ];
  for (const r of rows) {
    if (r.status !== "graded" || r.score == null) continue;
    const max = r.maxScore ?? 100;
    if (max <= 0) continue;
    const norm = (r.score / max) * 100;
    const idx = buckets.findIndex((b) => norm >= b.min && norm < b.max);
    if (idx >= 0) buckets[idx].count++;
  }
  return buckets;
}

/**
 * Returns scatter points (durationMinutes, normalizedScore) for graded rows
 * that have a usable durationSeconds. Quiz rows typically have duration; for
 * simulation/subjective we fall back to (gradedAt - submittedAt) but we don't
 * synthesize timings — caller filters those out.
 */
export function buildScatter(
  rows: NormalizedSubmission[]
): ScatterPoint[] {
  return rows
    .filter(
      (r) =>
        r.status === "graded" &&
        r.score != null &&
        r.durationSeconds != null &&
        r.durationSeconds > 0
    )
    .map((r) => {
      const max = r.maxScore ?? 100;
      const normScore = max > 0 ? (Number(r.score) / max) * 100 : 0;
      return {
        submissionId: r.id,
        studentName: r.studentName,
        durationMinutes: Math.round(((r.durationSeconds as number) / 60) * 10) / 10,
        score: Math.round(normScore * 10) / 10,
      };
    });
}

export function formatMinutes(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.round(seconds / 60);
  return `${m}'`;
}

export function formatRate(r: number | null): string {
  if (r == null) return "—";
  return `${Math.round(r * 100)}%`;
}

export function formatScore(n: number | null): string {
  if (n == null) return "—";
  return n.toString();
}
