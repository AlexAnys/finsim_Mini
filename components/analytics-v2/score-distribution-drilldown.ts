import type { ScoreBinStudent } from "@/lib/services/scope-drilldown.service";
import type {
  ScoreDistribution,
  ScoreDistributionBin,
  ScoreDistributionStudent,
} from "./score-distribution-chart";

export function rebinDistribution(
  source: ScoreDistribution,
  binCount: number,
): ScoreDistribution {
  const bucketSize = 100 / binCount;
  const bins: ScoreDistributionBin[] = Array.from({ length: binCount }, (_, index) => {
    const min = Math.round(index * bucketSize * 10) / 10;
    const max = Math.round((index + 1) * bucketSize * 10) / 10;
    return { label: `${min}-${max}`, min, max, classes: [] };
  });

  type Entry = ScoreDistributionStudent & { classId: string; classLabel: string };
  const entries: Entry[] = source.bins.flatMap((bin) =>
    bin.classes.flatMap((bucket) =>
      bucket.students.map((student) => ({
        ...student,
        classId: bucket.classId,
        classLabel: bucket.classLabel,
      })),
    ),
  );

  for (const entry of entries) {
    const clamped = Math.max(0, Math.min(100, entry.score));
    const binIndex = Math.min(binCount - 1, Math.floor(clamped / bucketSize));
    const bin = bins[binIndex];
    let bucket = bin.classes.find((item) => item.classId === entry.classId);
    if (!bucket) {
      bucket = { classId: entry.classId, classLabel: entry.classLabel, students: [] };
      bin.classes.push(bucket);
    }
    bucket.students.push({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      ...(entry.taskInstanceId ? { taskInstanceId: entry.taskInstanceId } : {}),
    });
  }

  for (const bin of bins) {
    for (const bucket of bin.classes) {
      bucket.students.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-CN"));
    }
    bin.classes.sort((a, b) => a.classLabel.localeCompare(b.classLabel, "zh-CN"));
  }

  return { bins, binCount, scope: source.scope, totalStudents: source.totalStudents };
}

/**
 * Build drawer rows from the exact bins currently rendered by the chart.
 * Keeping this client-side avoids re-computing with a different bin count or score scope.
 */
export function buildScoreDrilldownItems(
  bins: readonly ScoreDistributionBin[],
  classId?: string,
): ScoreBinStudent[] {
  return bins.flatMap((bin) =>
    bin.classes
      .filter((bucket) => !classId || bucket.classId === classId)
      .flatMap((bucket) =>
        bucket.students.map((student) => ({
          studentId: student.id,
          studentName: student.name,
          className: bucket.classLabel,
          classId: bucket.classId,
          binLabel: bin.label,
          score: student.score,
          taskInstanceId: student.taskInstanceId ?? null,
        })),
      ),
  );
}
