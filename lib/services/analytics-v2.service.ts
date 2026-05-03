import { prisma } from "@/lib/db/prisma";
import type { Prisma, TaskType } from "@prisma/client";

export type AnalyticsV2ScorePolicy = "latest" | "best" | "first";
export type AnalyticsV2Range = "7d" | "30d" | "term";

export interface AnalyticsV2DiagnosisInput {
  courseId: string;
  chapterId?: string;
  sectionId?: string;
  classIds?: string[];
  taskType?: TaskType;
  taskInstanceId?: string;
  scorePolicy?: AnalyticsV2ScorePolicy;
  range?: AnalyticsV2Range;
  now?: Date;
}

export interface AnalyticsV2Diagnosis {
  scope: {
    courseId: string;
    courseTitle: string;
    chapterId: string | null;
    sectionId: string | null;
    classIds: string[];
    taskType: TaskType | null;
    taskInstanceId: string | null;
    scorePolicy: AnalyticsV2ScorePolicy;
    range: AnalyticsV2Range;
    generatedAt: string;
  };
  filterOptions: {
    classes: Array<{ id: string; name: string }>;
    chapters: Array<{ id: string; title: string; order: number }>;
    sections: Array<{ id: string; title: string; chapterId: string; order: number }>;
    taskTypes: Array<{ value: TaskType; label: string; count: number }>;
    taskInstances: Array<{
      id: string;
      title: string;
      taskType: TaskType;
      classId: string;
      className: string;
      chapterId: string | null;
      sectionId: string | null;
    }>;
  };
  kpis: {
    instanceCount: number;
    assignedStudents: number;
    submittedStudents: number;
    gradedStudents: number;
    submissionCount: number;
    attemptCount: number;
    completionRate: number | null;
    avgNormalizedScore: number | null;
    medianNormalizedScore: number | null;
    passRate: number | null;
    pendingReleaseCount: number;
  };
  chapterClassHeatmap: ChapterClassHeatmapRow[];
  actionItems: ActionItem[];
  chapterDiagnostics: ChapterDiagnostic[];
  instanceDiagnostics: InstanceDiagnostic[];
  quizDiagnostics: QuizQuestionDiagnostic[];
  simulationDiagnostics: RubricCriterionDiagnostic[];
  studentInterventions: StudentIntervention[];
  weeklyInsight: WeeklyInsight;
  trends: AnalyticsV2Trends;
  dataQualityFlags: DataQualityFlag[];
  scoreDistribution: ScoreDistribution;
}

export interface ScoreDistribution {
  bins: ScoreDistributionBin[];
  binCount: number;
  scope: "single_task" | "multi_task";
  totalStudents: number;
}

export interface ScoreDistributionBin {
  label: string;
  min: number;
  max: number;
  classes: ScoreDistributionClassBucket[];
}

export interface ScoreDistributionClassBucket {
  classId: string;
  classLabel: string;
  students: ScoreDistributionStudent[];
}

export interface ScoreDistributionStudent {
  id: string;
  name: string;
  score: number;
  taskInstanceId?: string;
}

export interface DataQualityFlag {
  id: string;
  severity: "info" | "warning" | "critical";
  category: "scope" | "assignment" | "score" | "attempt" | "sample" | "aggregation";
  title: string;
  detail: string;
  entityType: "course" | "chapter" | "class" | "instance" | "student" | "submission";
  entityId?: string | null;
  entityLabel?: string | null;
  metric?: number | null;
  rawValue?: string | null;
}

export interface WeeklyInsight {
  generatedAt: string;
  mode: "local_fallback";
  label: string;
  highlights: WeeklyInsightItem[];
  risks: WeeklyInsightItem[];
  recommendations: WeeklyInsightItem[];
}

export interface WeeklyInsightItem {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  severity: "info" | "medium" | "high";
}

export interface AnalyticsV2Trends {
  generatedAt: string;
  range: AnalyticsV2Range;
  chapterTrend: ChapterTrendPoint[];
  classTrend: ClassTrendPoint[];
  studentGrowth: StudentGrowthPoint[];
}

export interface ChapterTrendPoint {
  chapterId: string | null;
  title: string;
  order: number | null;
  instanceCount: number;
  completionRate: number | null;
  avgNormalizedScore: number | null;
  latestActivityAt: string | null;
}

export interface ClassTrendPoint {
  classId: string;
  className: string;
  instanceCount: number;
  assignedStudents: number;
  submittedStudents: number;
  completionRate: number | null;
  avgNormalizedScore: number | null;
  latestActivityAt: string | null;
}

export interface StudentGrowthPoint {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  selectedScore: number | null;
  bestScore: number | null;
  improvement: number | null;
  attemptCount: number;
  completedInstances: number;
  firstSubmittedAt: string | null;
  latestSubmittedAt: string | null;
}

export interface ChapterClassHeatmapRow {
  chapterId: string | null;
  chapterTitle: string;
  classId: string;
  className: string;
  assignedStudents: number;
  submittedStudents: number;
  completionRate: number | null;
  avgNormalizedScore: number | null;
}

export interface ActionItem {
  type: "low_completion" | "low_score" | "weak_concept";
  severity: "high" | "medium";
  title: string;
  metric: number;
  instanceId?: string;
  chapterId?: string | null;
  classId?: string;
}

export interface ChapterDiagnostic {
  chapterId: string | null;
  title: string;
  instanceCount: number;
  assignedStudents: number;
  submittedStudents: number;
  completionRate: number | null;
  avgNormalizedScore: number | null;
  weaknesses: Array<{ tag: string; count: number }>;
}

export interface InstanceDiagnostic {
  instanceId: string;
  title: string;
  taskType: TaskType;
  classId: string;
  className: string;
  chapterId: string | null;
  chapterTitle: string | null;
  sectionId: string | null;
  assignedStudents: number;
  submittedStudents: number;
  completionRate: number | null;
  avgNormalizedScore: number | null;
  medianNormalizedScore: number | null;
  passRate: number | null;
  attemptCount: number;
  weaknesses: Array<{ tag: string; count: number }>;
}

export interface QuizQuestionDiagnostic {
  questionId: string;
  order: number;
  prompt: string;
  correctRate: number | null;
  unansweredRate: number | null;
  avgScoreRate: number | null;
  weakTags: string[];
}

export interface RubricCriterionDiagnostic {
  criterionId: string;
  criterionName: string;
  avgScoreRate: number | null;
  lowScoreCount: number;
  weakStudents: Array<{ studentId: string; studentName: string }>;
  sampleComments: string[];
}

export interface StudentIntervention {
  studentId: string;
  studentName: string;
  instanceId: string;
  instanceTitle: string;
  classId: string;
  className: string;
  attemptCount: number;
  bestScore: number | null;
  improvement: number | null;
  selectedScore: number | null;
  reason: "not_submitted" | "low_score" | "declining";
}

export interface AttemptSubmission {
  id: string;
  studentId: string;
  status: string;
  score: number | string | Prisma.Decimal | null;
  maxScore: number | string | Prisma.Decimal | null;
  submittedAt: Date | string;
}

export interface StudentAttemptMetrics {
  studentId: string;
  attemptCount: number;
  selectedSubmission: AttemptSubmission | null;
  selectedScore: number | null;
  firstScore: number | null;
  latestScore: number | null;
  bestScore: number | null;
  improvement: number | null;
}

interface StudentRef {
  id: string;
  name: string;
  classId: string | null;
}

interface SubmissionDetail {
  evaluation: unknown;
  conceptTags: string[];
}

interface DiagnosisSubmission extends AttemptSubmission {
  taskType: TaskType;
  student: { id: string; name: string };
  simulationSubmission: SubmissionDetail | null;
  quizSubmission: (SubmissionDetail & { durationSeconds: number | null }) | null;
  subjectiveSubmission: SubmissionDetail | null;
}

interface DiagnosisInstance {
  id: string;
  title: string;
  taskType: TaskType;
  classId: string;
  groupIds: string[];
  chapterId: string | null;
  sectionId: string | null;
  taskId: string;
  dueAt?: Date | string | null;
  publishedAt?: Date | string | null;
  publishAt?: Date | string | null;
  createdAt?: Date | string | null;
  class: { id: string; name: string };
  chapter: { id: string; title: string; order: number } | null;
  section: { id: string; title: string; chapterId: string; order: number } | null;
  task: {
    quizQuestions: Array<{
      id: string;
      prompt: string;
      points: number;
      order: number;
    }>;
    scoringCriteria: Array<{
      id: string;
      name: string;
      maxPoints: number;
      order: number;
    }>;
  };
  submissions: DiagnosisSubmission[];
}

interface CourseForAnalyticsOptions {
  id: string;
  courseTitle: string;
  class: { id: string; name: string };
  classes: Array<{ class: { id: string; name: string } }>;
  chapters: Array<{
    id: string;
    title: string;
    order: number;
    sections: Array<{ id: string; title: string; chapterId: string; order: number }>;
  }>;
}

interface OptionInstance {
  id: string;
  title: string;
  taskType: TaskType;
  classId: string;
  chapterId: string | null;
  sectionId: string | null;
  class: { id: string; name: string };
}

interface InstanceMetrics {
  instance: DiagnosisInstance;
  assignedStudents: StudentRef[];
  assignedCount: number;
  submittedCount: number;
  gradedCount: number;
  submissionCount: number;
  attemptCount: number;
  completionRate: number | null;
  scores: number[];
  avgNormalizedScore: number | null;
  medianNormalizedScore: number | null;
  passRate: number | null;
  weaknesses: Map<string, Set<string>>;
  studentAttempts: Map<string, StudentAttemptMetrics>;
  dataQualityFlags: DataQualityFlag[];
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const PASS_THRESHOLD = 60;
const LOW_SCORE_THRESHOLD = 60;

export const RISK_CHAPTER_COMPLETION_THRESHOLD = 0.6;
export const RISK_CHAPTER_SCORE_THRESHOLD = 60;

export function isRiskChapter(c: {
  completionRate: number | null;
  avgNormalizedScore: number | null;
}): boolean {
  return (
    (c.completionRate !== null && c.completionRate < RISK_CHAPTER_COMPLETION_THRESHOLD) ||
    (c.avgNormalizedScore !== null && c.avgNormalizedScore < RISK_CHAPTER_SCORE_THRESHOLD)
  );
}

export function normalizeScore(
  score: number | string | Prisma.Decimal | null | undefined,
  maxScore: number | string | Prisma.Decimal | null | undefined,
): number | null {
  if (score === null || score === undefined || maxScore === null || maxScore === undefined) {
    return null;
  }
  const numericScore = Number(score);
  const numericMax = Number(maxScore);
  if (!Number.isFinite(numericScore) || !Number.isFinite(numericMax) || numericMax <= 0) {
    return null;
  }
  return round1((numericScore / numericMax) * 100);
}

export function selectSubmissionForScore<T extends AttemptSubmission>(
  submissions: T[],
  scorePolicy: AnalyticsV2ScorePolicy = "latest",
): T | null {
  const scored = submissions.filter(
    (s) => s.status === "graded" && normalizeScore(s.score, s.maxScore) !== null,
  );
  if (scored.length === 0) return null;

  const sorted = [...scored].sort(compareSubmittedAt);
  if (scorePolicy === "first") return sorted[0];
  if (scorePolicy === "latest") return sorted[sorted.length - 1];

  return sorted.reduce((best, current) => {
    const bestScore = normalizeScore(best.score, best.maxScore) ?? Number.NEGATIVE_INFINITY;
    const currentScore = normalizeScore(current.score, current.maxScore) ?? Number.NEGATIVE_INFINITY;
    if (currentScore > bestScore) return current;
    if (currentScore === bestScore && compareSubmittedAt(current, best) > 0) return current;
    return best;
  });
}

export function buildStudentInstanceAttempts<T extends AttemptSubmission>(
  submissions: T[],
  scorePolicy: AnalyticsV2ScorePolicy = "latest",
): StudentAttemptMetrics[] {
  const byStudent = new Map<string, T[]>();
  for (const submission of submissions) {
    const rows = byStudent.get(submission.studentId) ?? [];
    rows.push(submission);
    byStudent.set(submission.studentId, rows);
  }

  return Array.from(byStudent.entries()).map(([studentId, rows]) => {
    const sorted = [...rows].sort(compareSubmittedAt);
    const scored = sorted
      .map((submission) => ({
        submission,
        normalizedScore:
          submission.status === "graded"
            ? normalizeScore(submission.score, submission.maxScore)
            : null,
      }))
      .filter((row): row is { submission: T; normalizedScore: number } => row.normalizedScore !== null);
    const selectedSubmission = selectSubmissionForScore(sorted, scorePolicy);
    const selectedScore = selectedSubmission
      ? normalizeScore(selectedSubmission.score, selectedSubmission.maxScore)
      : null;
    const firstScore = scored[0]?.normalizedScore ?? null;
    const latestScore = scored[scored.length - 1]?.normalizedScore ?? null;
    const bestScore =
      scored.length > 0
        ? Math.max(...scored.map((row) => row.normalizedScore))
        : null;
    const improvement =
      firstScore !== null && latestScore !== null && scored.length >= 2
        ? round1(latestScore - firstScore)
        : null;

    return {
      studentId,
      attemptCount: rows.length,
      selectedSubmission,
      selectedScore,
      firstScore,
      latestScore,
      bestScore,
      improvement,
    };
  });
}

export interface WeaknessSignal {
  tag: string;
  reason: "low_score" | "wrong_question" | "low_rubric" | "feedback";
  evidence: string;
}

export function extractWeaknessSignals(submission: {
  score: number | string | Prisma.Decimal | null;
  maxScore: number | string | Prisma.Decimal | null;
  simulationSubmission?: SubmissionDetail | null;
  quizSubmission?: SubmissionDetail | null;
  subjectiveSubmission?: SubmissionDetail | null;
}): WeaknessSignal[] {
  const tags = getConceptTags(submission);
  if (tags.length === 0) return [];

  const evaluation = getEvaluation(submission);
  const reasons: Array<Omit<WeaknessSignal, "tag">> = [];
  const normalized = normalizeScore(submission.score, submission.maxScore);
  if (normalized !== null && normalized < LOW_SCORE_THRESHOLD) {
    reasons.push({
      reason: "low_score",
      evidence: `normalizedScore=${normalized}`,
    });
  }

  if (hasWrongQuizAnswer(evaluation)) {
    reasons.push({
      reason: "wrong_question",
      evidence: "quizBreakdown contains incorrect or low-score answers",
    });
  }

  if (hasLowRubricScore(evaluation)) {
    reasons.push({
      reason: "low_rubric",
      evidence: "rubricBreakdown contains low-score criteria",
    });
  }

  if (hasExplicitWeaknessFeedback(evaluation)) {
    reasons.push({
      reason: "feedback",
      evidence: "feedback explicitly describes weakness",
    });
  }

  if (reasons.length === 0) return [];

  const firstReason = reasons[0];
  return tags.map((tag) => ({ tag, ...firstReason }));
}

export async function getAnalyticsV2Diagnosis(
  input: AnalyticsV2DiagnosisInput,
): Promise<AnalyticsV2Diagnosis> {
  const scorePolicy = input.scorePolicy ?? "latest";
  const range = input.range ?? "term";
  const now = input.now ?? new Date();
  const dateFrom = getDateFromRange(range, now);

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      courseTitle: true,
      classId: true,
      class: { select: { id: true, name: true } },
      classes: {
        select: {
          class: { select: { id: true, name: true } },
        },
      },
      chapters: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          sections: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, chapterId: true, order: true },
          },
        },
      },
    },
  });
  if (!course) throw new Error("COURSE_NOT_FOUND");

  const optionInstances = await prisma.taskInstance.findMany({
    where: {
      courseId: input.courseId,
      status: { not: "draft" },
    },
    select: {
      id: true,
      title: true,
      taskType: true,
      classId: true,
      chapterId: true,
      sectionId: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const instances = await prisma.taskInstance.findMany({
    where: buildInstanceWhere(input, dateFrom),
    include: {
      class: { select: { id: true, name: true } },
      chapter: { select: { id: true, title: true, order: true } },
      section: { select: { id: true, title: true, chapterId: true, order: true } },
      task: {
        select: {
          quizQuestions: {
            orderBy: { order: "asc" },
            select: { id: true, prompt: true, points: true, order: true },
          },
          scoringCriteria: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, maxPoints: true, order: true },
          },
        },
      },
      submissions: {
        where: dateFrom ? { submittedAt: { gte: dateFrom } } : undefined,
        include: {
          student: { select: { id: true, name: true } },
          simulationSubmission: { select: { evaluation: true, conceptTags: true } },
          quizSubmission: { select: { evaluation: true, conceptTags: true, durationSeconds: true } },
          subjectiveSubmission: { select: { evaluation: true, conceptTags: true } },
        },
        orderBy: { submittedAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const diagnosisInstances = instances as DiagnosisInstance[];
  const assignmentLookup = await buildAssignmentLookup(diagnosisInstances);
  const instanceMetrics = diagnosisInstances.map((instance) =>
    buildInstanceMetrics(instance, assignmentLookup, scorePolicy),
  );

  const allScores = instanceMetrics.flatMap((metric) => metric.scores);
  const assignedStudents = sum(instanceMetrics.map((metric) => metric.assignedCount));
  const submittedStudents = sum(instanceMetrics.map((metric) => metric.submittedCount));
  const gradedStudents = sum(instanceMetrics.map((metric) => metric.gradedCount));
  const submissionCount = sum(instanceMetrics.map((metric) => metric.submissionCount));
  const attemptCount = sum(instanceMetrics.map((metric) => metric.attemptCount));
  const generatedAt = now.toISOString();
  const kpis: AnalyticsV2Diagnosis["kpis"] = {
    instanceCount: instanceMetrics.length,
    assignedStudents,
    submittedStudents,
    gradedStudents,
    submissionCount,
    attemptCount,
    completionRate: rate(submittedStudents, assignedStudents),
    avgNormalizedScore: average(allScores),
    medianNormalizedScore: median(allScores),
    passRate: rate(allScores.filter((score) => score >= PASS_THRESHOLD).length, allScores.length),
    pendingReleaseCount: 0,
  };
  const chapterClassHeatmap = buildChapterClassHeatmap(instanceMetrics);
  const actionItems = buildActionItems(instanceMetrics);
  const chapterDiagnostics = buildChapterDiagnostics(course.chapters, instanceMetrics, input.chapterId);
  const instanceDiagnostics = instanceMetrics.map(toInstanceDiagnostic);
  const quizDiagnostics = buildQuizDiagnostics(instanceMetrics);
  const simulationDiagnostics = buildRubricDiagnostics(instanceMetrics);
  const studentInterventions = buildStudentInterventions(instanceMetrics);
  const trends = buildAnalyticsTrends(instanceMetrics, range, generatedAt);
  const pendingReleaseCount = await prisma.submission.count({
    where: {
      releasedAt: null,
      taskInstance: {
        ...buildInstanceWhere(input, null),
        dueAt: { lt: now },
      },
    },
  });
  kpis.pendingReleaseCount = pendingReleaseCount;
  const filterOptions = buildFilterOptions(course, optionInstances);
  const scoreDistribution = computeScoreDistribution(input, instanceMetrics, filterOptions.classes);
  const dataQualityFlags = buildDataQualityFlags(instanceMetrics, kpis);

  return {
    scope: {
      courseId: course.id,
      courseTitle: course.courseTitle,
      chapterId: input.chapterId ?? null,
      sectionId: input.sectionId ?? null,
      classIds: input.classIds ?? [],
      taskType: input.taskType ?? null,
      taskInstanceId: input.taskInstanceId ?? null,
      scorePolicy,
      range,
      generatedAt,
    },
    filterOptions,
    kpis,
    chapterClassHeatmap,
    actionItems,
    chapterDiagnostics,
    instanceDiagnostics,
    quizDiagnostics,
    simulationDiagnostics,
    studentInterventions,
    weeklyInsight: buildWeeklyInsight({
      generatedAt,
      kpis,
      actionItems,
      chapterDiagnostics,
      quizDiagnostics,
      simulationDiagnostics,
      studentInterventions,
    }),
    trends,
    dataQualityFlags,
    scoreDistribution,
  };
}

const SCORE_DISTRIBUTION_DEFAULT_BIN_COUNT = 5;

function computeScoreDistribution(
  input: AnalyticsV2DiagnosisInput,
  instanceMetrics: InstanceMetrics[],
  classOptions: Array<{ id: string; name: string }>,
  binCount: number = SCORE_DISTRIBUTION_DEFAULT_BIN_COUNT,
): ScoreDistribution {
  const bucketSize = 100 / binCount;
  const bins: ScoreDistributionBin[] = Array.from({ length: binCount }, (_, index) => {
    const min = Math.round(index * bucketSize * 10) / 10;
    const max = Math.round((index + 1) * bucketSize * 10) / 10;
    return {
      label: `${min}-${max}`,
      min,
      max,
      classes: [],
    };
  });

  const isSingleTask = Boolean(input.taskInstanceId) || instanceMetrics.length === 1;

  type Entry = {
    classId: string;
    studentId: string;
    studentName: string;
    score: number;
    taskInstanceId?: string;
  };
  const entries: Entry[] = [];

  if (isSingleTask) {
    for (const metric of instanceMetrics) {
      for (const attempt of metric.studentAttempts.values()) {
        if (attempt.selectedScore === null) continue;
        const student = metric.assignedStudents.find((s) => s.id === attempt.studentId);
        if (!student) continue;
        entries.push({
          classId: metric.instance.classId,
          studentId: student.id,
          studentName: student.name,
          score: attempt.selectedScore,
          taskInstanceId: metric.instance.id,
        });
      }
    }
  } else {
    const byStudent = new Map<
      string,
      { classId: string; studentId: string; studentName: string; scores: number[] }
    >();
    for (const metric of instanceMetrics) {
      for (const attempt of metric.studentAttempts.values()) {
        if (attempt.selectedScore === null) continue;
        const student = metric.assignedStudents.find((s) => s.id === attempt.studentId);
        if (!student) continue;
        const row = byStudent.get(student.id) ?? {
          classId: metric.instance.classId,
          studentId: student.id,
          studentName: student.name,
          scores: [],
        };
        row.scores.push(attempt.selectedScore);
        byStudent.set(student.id, row);
      }
    }
    for (const row of byStudent.values()) {
      const avg = average(row.scores);
      if (avg === null) continue;
      entries.push({
        classId: row.classId,
        studentId: row.studentId,
        studentName: row.studentName,
        score: avg,
      });
    }
  }

  const classLabelById = new Map(classOptions.map((c) => [c.id, c.name]));

  for (const entry of entries) {
    const clamped = Math.max(0, Math.min(100, entry.score));
    const binIndex = Math.min(binCount - 1, Math.floor(clamped / bucketSize));
    const bin = bins[binIndex];
    const classLabel = classLabelById.get(entry.classId) ?? entry.classId;
    let bucket = bin.classes.find((c) => c.classId === entry.classId);
    if (!bucket) {
      bucket = { classId: entry.classId, classLabel, students: [] };
      bin.classes.push(bucket);
    }
    bucket.students.push({
      id: entry.studentId,
      name: entry.studentName,
      score: round1(entry.score),
      ...(entry.taskInstanceId ? { taskInstanceId: entry.taskInstanceId } : {}),
    });
  }

  for (const bin of bins) {
    for (const bucket of bin.classes) {
      bucket.students.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-CN"));
    }
    bin.classes.sort((a, b) => a.classLabel.localeCompare(b.classLabel, "zh-CN"));
  }

  return {
    bins,
    binCount,
    scope: isSingleTask ? "single_task" : "multi_task",
    totalStudents: entries.length,
  };
}

function buildInstanceWhere(
  input: AnalyticsV2DiagnosisInput,
  dateFrom: Date | null,
): Prisma.TaskInstanceWhereInput {
  return {
    courseId: input.courseId,
    status: { not: "draft" },
    ...(input.chapterId && { chapterId: input.chapterId }),
    ...(input.sectionId && { sectionId: input.sectionId }),
    ...(input.classIds && input.classIds.length > 0 ? { classId: { in: input.classIds } } : {}),
    ...(input.taskType && { taskType: input.taskType }),
    ...(input.taskInstanceId && { id: input.taskInstanceId }),
    ...(dateFrom && {
      OR: [
        { publishedAt: { gte: dateFrom } },
        { dueAt: { gte: dateFrom } },
        { createdAt: { gte: dateFrom } },
      ],
    }),
  };
}

async function buildAssignmentLookup(instances: DiagnosisInstance[]) {
  const classIds = Array.from(new Set(instances.map((instance) => instance.classId)));
  const groupIds = Array.from(new Set(instances.flatMap((instance) => instance.groupIds)));

  const [classStudents, groups] = await Promise.all([
    classIds.length > 0
      ? prisma.user.findMany({
          where: { role: "student", classId: { in: classIds } },
          select: { id: true, name: true, classId: true },
        })
      : Promise.resolve([]),
    groupIds.length > 0
      ? prisma.studentGroup.findMany({
          where: { id: { in: groupIds }, classId: { in: classIds } },
          select: {
            id: true,
            classId: true,
            members: {
              select: {
                student: { select: { id: true, name: true, classId: true, role: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const classStudentsByClass = new Map<string, StudentRef[]>();
  for (const student of classStudents) {
    if (!student.classId) continue;
    const rows = classStudentsByClass.get(student.classId) ?? [];
    rows.push({ id: student.id, name: student.name, classId: student.classId });
    classStudentsByClass.set(student.classId, rows);
  }

  const groupStudentsByGroup = new Map<string, StudentRef[]>();
  for (const group of groups) {
    const members: StudentRef[] = [];
    const seen = new Set<string>();
    for (const member of group.members) {
      const student = member.student;
      if (student.role !== "student") continue;
      if (student.classId !== group.classId) continue;
      if (seen.has(student.id)) continue;
      seen.add(student.id);
      members.push({ id: student.id, name: student.name, classId: student.classId });
    }
    groupStudentsByGroup.set(group.id, members);
  }

  return { classStudentsByClass, groupStudentsByGroup };
}

function buildInstanceMetrics(
  instance: DiagnosisInstance,
  assignmentLookup: Awaited<ReturnType<typeof buildAssignmentLookup>>,
  scorePolicy: AnalyticsV2ScorePolicy,
): InstanceMetrics {
  const assignedStudents = getAssignedStudents(instance, assignmentLookup);
  const assignedIds = new Set(assignedStudents.map((student) => student.id));
  const scopedSubmissions =
    assignedIds.size > 0
      ? instance.submissions.filter((submission) => assignedIds.has(submission.studentId))
      : [];
  const submissionsByStudent = groupByStudent(scopedSubmissions);
  const submittedCount = submissionsByStudent.size;
  const attempts = buildStudentInstanceAttempts(scopedSubmissions, scorePolicy);
  const studentAttempts = new Map(attempts.map((attempt) => [attempt.studentId, attempt]));

  const scores: number[] = [];
  const weaknesses = new Map<string, Set<string>>();
  let gradedCount = 0;
  for (const attempt of attempts) {
    if (!attempt.selectedSubmission) continue;
    if (attempt.selectedScore === null) continue;
    gradedCount += 1;
    scores.push(attempt.selectedScore);
    const selected = attempt.selectedSubmission as DiagnosisSubmission;
    for (const signal of extractWeaknessSignals(selected)) {
      const studentSet = weaknesses.get(signal.tag) ?? new Set<string>();
      studentSet.add(attempt.studentId);
      weaknesses.set(signal.tag, studentSet);
    }
  }
  const dataQualityFlags = buildInstanceDataQualityFlags({
    instance,
    assignedCount: assignedStudents.length,
    submittedCount,
    scopedSubmissions,
    rawSubmissions: instance.submissions,
    attempts,
    scores,
    scorePolicy,
  });

  return {
    instance,
    assignedStudents,
    assignedCount: assignedStudents.length,
    submittedCount,
    gradedCount,
    submissionCount: scopedSubmissions.length,
    attemptCount: scopedSubmissions.length,
    completionRate: rate(submittedCount, assignedStudents.length),
    scores,
    avgNormalizedScore: average(scores),
    medianNormalizedScore: median(scores),
    passRate: rate(scores.filter((score) => score >= PASS_THRESHOLD).length, scores.length),
    weaknesses,
    studentAttempts,
    dataQualityFlags,
  };
}

function getAssignedStudents(
  instance: DiagnosisInstance,
  assignmentLookup: Awaited<ReturnType<typeof buildAssignmentLookup>>,
): StudentRef[] {
  const byId = new Map<string, StudentRef>();
  if (instance.groupIds.length > 0) {
    for (const groupId of instance.groupIds) {
      const students = assignmentLookup.groupStudentsByGroup.get(groupId) ?? [];
      for (const student of students) {
        if (student.classId === instance.classId) byId.set(student.id, student);
      }
    }
    return Array.from(byId.values()).sort(compareStudentName);
  }

  return [...(assignmentLookup.classStudentsByClass.get(instance.classId) ?? [])].sort(compareStudentName);
}

function buildInstanceDataQualityFlags(input: {
  instance: DiagnosisInstance;
  assignedCount: number;
  submittedCount: number;
  scopedSubmissions: DiagnosisSubmission[];
  rawSubmissions: DiagnosisSubmission[];
  attempts: StudentAttemptMetrics[];
  scores: number[];
  scorePolicy: AnalyticsV2ScorePolicy;
}): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];
  const { instance } = input;
  const instanceLabel = `${instance.title} · ${instance.class.name}`;

  if (!instance.chapterId) {
    flags.push(flag({
      id: `${instance.id}:unbound-chapter`,
      severity: "warning",
      category: "scope",
      title: "任务未关联章节",
      detail: "该任务实例没有 chapterId，只能放入“未关联章节”，章节诊断和长期趋势的教学含义会变弱。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
    }));
  } else if (!instance.sectionId) {
    flags.push(flag({
      id: `${instance.id}:unbound-section`,
      severity: "info",
      category: "scope",
      title: "任务未关联小节",
      detail: "该任务实例已关联章节但未关联小节，小节级筛选和诊断无法覆盖这条数据。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
    }));
  }

  if (input.assignedCount === 0 && input.rawSubmissions.length > 0) {
    flags.push(flag({
      id: `${instance.id}:assignment-missing-with-submissions`,
      severity: "critical",
      category: "assignment",
      title: "有提交但缺少应提交学生基线",
      detail: "系统找不到该任务对应的班级学生或分组成员，因此完成率不能可靠计算；请检查班级、分组和任务实例绑定。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
      metric: input.rawSubmissions.length,
      rawValue: `${input.rawSubmissions.length} 次原始提交`,
    }));
  } else if (input.assignedCount === 0) {
    flags.push(flag({
      id: `${instance.id}:assignment-missing`,
      severity: "warning",
      category: "assignment",
      title: "缺少应提交学生基线",
      detail: "系统找不到该任务对应的班级学生或分组成员，完成率和未完成名单会为空。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
    }));
  }

  if (input.assignedCount > 0 && input.submittedCount > input.assignedCount) {
    flags.push(flag({
      id: `${instance.id}:completion-over-100`,
      severity: "critical",
      category: "aggregation",
      title: "完成率超过 100%",
      detail: "已提交学生数超过应提交学生数，通常意味着班级/分组绑定或提交归属异常；图表会显示原始值并标记需核对。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
      metric: rate(input.submittedCount, input.assignedCount),
      rawValue: `${input.submittedCount}/${input.assignedCount}`,
    }));
  }

  const outOfScopeStudentCount =
    input.assignedCount > 0
      ? input.rawSubmissions.filter((submission) => !input.scopedSubmissions.some((scoped) => scoped.id === submission.id)).length
      : 0;
  if (outOfScopeStudentCount > 0) {
    flags.push(flag({
      id: `${instance.id}:out-of-assignment-submissions`,
      severity: "warning",
      category: "assignment",
      title: "存在非分配学生提交",
      detail: "部分提交不属于该任务实例的班级或分组学生，已从诊断统计中排除；请核对测试账号或班级绑定。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
      metric: outOfScopeStudentCount,
      rawValue: `${outOfScopeStudentCount} 次提交`,
    }));
  }

  const multiAttemptStudents = input.attempts.filter((attempt) => attempt.attemptCount > 1).length;
  if (multiAttemptStudents > 0) {
    flags.push(flag({
      id: `${instance.id}:multiple-attempts`,
      severity: "info",
      category: "attempt",
      title: "存在多次提交",
      detail: `该实例有 ${multiAttemptStudents} 名学生多次提交；当前成绩口径使用“${scorePolicyLabel(input.scorePolicy)}”，练习效果请同时看最高分、提升幅度和尝试次数。`,
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
      metric: multiAttemptStudents,
    }));
  }

  const abnormalScores = input.scopedSubmissions.filter((submission) => {
    if (submission.status !== "graded") return false;
    const score = Number(submission.score);
    const maxScore = Number(submission.maxScore);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return true;
    return score < 0 || score > maxScore;
  });
  if (abnormalScores.length > 0) {
    const sample = abnormalScores[0];
    flags.push(flag({
      id: `${instance.id}:score-abnormal`,
      severity: "critical",
      category: "score",
      title: "分数或满分异常",
      detail: "存在 score/maxScore 缺失、非数字、满分小于等于 0、负分或得分超过满分的提交；均分会保留原始计算结果并标记需核对。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
      metric: abnormalScores.length,
      rawValue: sample ? `sample ${sample.id}: ${String(sample.score)}/${String(sample.maxScore)}` : null,
    }));
  }

  if (input.scores.some((score) => score > 100)) {
    flags.push(flag({
      id: `${instance.id}:normalized-score-over-100`,
      severity: "critical",
      category: "score",
      title: "归一化分数超过 100%",
      detail: "至少一条已选成绩超过满分，能力诊断会保留原始值，但进度条/热力图按 100% 封顶展示。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
      metric: Math.max(...input.scores),
    }));
  }

  if (input.assignedCount >= 3 && input.submittedCount > 0 && input.submittedCount < 3) {
    flags.push(flag({
      id: `${instance.id}:sample-too-small`,
      severity: "info",
      category: "sample",
      title: "样本量较小",
      detail: "当前范围内有效提交少于 3 人，均分、题目正确率和 rubric 低分率更适合做个案参考，不宜直接下班级结论。",
      entityType: "instance",
      entityId: instance.id,
      entityLabel: instanceLabel,
      metric: input.submittedCount,
    }));
  }

  return flags;
}

function buildDataQualityFlags(
  metrics: InstanceMetrics[],
  kpis: AnalyticsV2Diagnosis["kpis"],
): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];

  if (kpis.instanceCount > 0 && kpis.assignedStudents === 0) {
    flags.push(flag({
      id: "aggregate:assigned-students-missing",
      severity: "critical",
      category: "assignment",
      title: "当前范围缺少应提交学生基线",
      detail: "当前筛选范围内有任务实例，但没有可用于计算完成率的班级或分组学生；请先核对课程班级和任务分配。",
      entityType: "course",
      entityId: null,
      entityLabel: "当前范围",
    }));
  }

  if (kpis.completionRate !== null && kpis.completionRate > 1) {
    flags.push(flag({
      id: "aggregate:completion-over-100",
      severity: "critical",
      category: "aggregation",
      title: "当前范围完成率超过 100%",
      detail: "聚合后已提交人次超过应提交人次，通常意味着任务分配或提交归属异常；请优先核对实例级提示。",
      entityType: "course",
      entityId: null,
      entityLabel: "当前范围",
      metric: kpis.completionRate,
      rawValue: `${kpis.submittedStudents}/${kpis.assignedStudents}`,
    }));
  }

  if (kpis.avgNormalizedScore !== null && kpis.avgNormalizedScore > 100) {
    flags.push(flag({
      id: "aggregate:avg-score-over-100",
      severity: "critical",
      category: "score",
      title: "当前范围均分超过 100%",
      detail: "聚合后的归一化均分超过满分，请核对已批改提交的 score/maxScore。",
      entityType: "course",
      entityId: null,
      entityLabel: "当前范围",
      metric: kpis.avgNormalizedScore,
    }));
  }

  if (kpis.gradedStudents > 0 && kpis.gradedStudents < 3) {
    flags.push(flag({
      id: "aggregate:small-graded-sample",
      severity: "info",
      category: "sample",
      title: "已评分样本较小",
      detail: "当前范围已评分学生少于 3 人，均分和薄弱点建议只作为早期信号，不宜形成班级诊断结论。",
      entityType: "course",
      entityId: null,
      entityLabel: "当前范围",
      metric: kpis.gradedStudents,
    }));
  }

  return [...flags, ...metrics.flatMap((metric) => metric.dataQualityFlags)].slice(0, 80);
}

function flag(input: DataQualityFlag): DataQualityFlag {
  return input;
}

function scorePolicyLabel(scorePolicy: AnalyticsV2ScorePolicy) {
  if (scorePolicy === "best") return "最高分";
  if (scorePolicy === "first") return "首次";
  return "最近一次";
}

function buildFilterOptions(
  course: CourseForAnalyticsOptions,
  optionInstances: OptionInstance[],
): AnalyticsV2Diagnosis["filterOptions"] {
  const classesById = new Map<string, { id: string; name: string }>();
  classesById.set(course.class.id, course.class);
  for (const row of course.classes) {
    classesById.set(row.class.id, row.class);
  }

  const taskTypeCounts = new Map<TaskType, number>();
  for (const instance of optionInstances) {
    taskTypeCounts.set(instance.taskType, (taskTypeCounts.get(instance.taskType) ?? 0) + 1);
  }

  const chapters = course.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    order: chapter.order,
  }));
  const sections = course.chapters.flatMap((chapter) =>
    chapter.sections.map((section) => ({
      id: section.id,
      title: section.title,
      chapterId: section.chapterId,
      order: section.order,
    })),
  );

  return {
    classes: Array.from(classesById.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    chapters,
    sections,
    taskTypes: Array.from(taskTypeCounts.entries())
      .map(([value, count]) => ({ value, label: TASK_TYPE_LABELS[value], count }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
    taskInstances: optionInstances.map((instance) => ({
      id: instance.id,
      title: instance.title,
      taskType: instance.taskType,
      classId: instance.classId,
      className: instance.class.name,
      chapterId: instance.chapterId,
      sectionId: instance.sectionId,
    })),
  };
}

function buildChapterClassHeatmap(metrics: InstanceMetrics[]): ChapterClassHeatmapRow[] {
  const grouped = new Map<string, InstanceMetrics[]>();
  for (const metric of metrics) {
    const key = `${metric.instance.chapterId ?? "unassigned"}::${metric.instance.classId}`;
    const rows = grouped.get(key) ?? [];
    rows.push(metric);
    grouped.set(key, rows);
  }

  return Array.from(grouped.values()).map((rows) => {
    const first = rows[0].instance;
    const scores = rows.flatMap((row) => row.scores);
    const assignedStudents = sum(rows.map((row) => row.assignedCount));
    const submittedStudents = sum(rows.map((row) => row.submittedCount));
    return {
      chapterId: first.chapterId,
      chapterTitle: first.chapter?.title ?? "未关联章节",
      classId: first.classId,
      className: first.class.name,
      assignedStudents,
      submittedStudents,
      completionRate: rate(submittedStudents, assignedStudents),
      avgNormalizedScore: average(scores),
    };
  });
}

function buildChapterDiagnostics(
  chapters: Array<{ id: string; title: string; order: number }>,
  metrics: InstanceMetrics[],
  scopedChapterId?: string,
): ChapterDiagnostic[] {
  const byChapter = new Map<string, InstanceMetrics[]>();
  for (const metric of metrics) {
    const key = metric.instance.chapterId ?? "unassigned";
    const rows = byChapter.get(key) ?? [];
    rows.push(metric);
    byChapter.set(key, rows);
  }

  const chapterRows = scopedChapterId
    ? chapters.filter((chapter) => chapter.id === scopedChapterId)
    : chapters;
  const knownChapterIds = new Set(chapterRows.map((chapter) => chapter.id));
  const diagnostics: ChapterDiagnostic[] = chapterRows.map((chapter) =>
    toChapterDiagnostic(chapter.id, chapter.title, byChapter.get(chapter.id) ?? []),
  );
  const unassigned = byChapter.get("unassigned") ?? [];
  if (unassigned.length > 0) {
    diagnostics.push(toChapterDiagnostic(null, "未关联章节", unassigned));
  }
  for (const [chapterId, rows] of byChapter.entries()) {
    if (chapterId === "unassigned" || knownChapterIds.has(chapterId)) continue;
    diagnostics.push(toChapterDiagnostic(chapterId, rows[0].instance.chapter?.title ?? "未知章节", rows));
  }
  return diagnostics;
}

function toChapterDiagnostic(
  chapterId: string | null,
  title: string,
  rows: InstanceMetrics[],
): ChapterDiagnostic {
  const assignedStudents = sum(rows.map((row) => row.assignedCount));
  const submittedStudents = sum(rows.map((row) => row.submittedCount));
  const scores = rows.flatMap((row) => row.scores);
  return {
    chapterId,
    title,
    instanceCount: rows.length,
    assignedStudents,
    submittedStudents,
    completionRate: rate(submittedStudents, assignedStudents),
    avgNormalizedScore: average(scores),
    weaknesses: topWeaknesses(rows),
  };
}

function toInstanceDiagnostic(metric: InstanceMetrics): InstanceDiagnostic {
  const instance = metric.instance;
  return {
    instanceId: instance.id,
    title: instance.title,
    taskType: instance.taskType,
    classId: instance.classId,
    className: instance.class.name,
    chapterId: instance.chapterId,
    chapterTitle: instance.chapter?.title ?? null,
    sectionId: instance.sectionId,
    assignedStudents: metric.assignedCount,
    submittedStudents: metric.submittedCount,
    completionRate: metric.completionRate,
    avgNormalizedScore: metric.avgNormalizedScore,
    medianNormalizedScore: metric.medianNormalizedScore,
    passRate: metric.passRate,
    attemptCount: metric.attemptCount,
    weaknesses: topWeaknesses([metric]),
  };
}

function buildActionItems(metrics: InstanceMetrics[]): ActionItem[] {
  const items: ActionItem[] = [];
  for (const metric of metrics) {
    if (metric.assignedCount > 0 && (metric.completionRate ?? 1) < 0.6) {
      items.push({
        type: "low_completion",
        severity: "high",
        title: `${metric.instance.title} 完成率偏低`,
        metric: metric.completionRate ?? 0,
        instanceId: metric.instance.id,
        chapterId: metric.instance.chapterId,
        classId: metric.instance.classId,
      });
    }
    if (metric.avgNormalizedScore !== null && metric.avgNormalizedScore < LOW_SCORE_THRESHOLD) {
      items.push({
        type: "low_score",
        severity: "medium",
        title: `${metric.instance.title} 平均分偏低`,
        metric: metric.avgNormalizedScore,
        instanceId: metric.instance.id,
        chapterId: metric.instance.chapterId,
        classId: metric.instance.classId,
      });
    }
  }

  for (const weakness of topWeaknesses(metrics).slice(0, 3)) {
    items.push({
      type: "weak_concept",
      severity: "medium",
      title: `${weakness.tag} 需要关注`,
      metric: weakness.count,
    });
  }

  return items.slice(0, 8);
}

function buildStudentInterventions(metrics: InstanceMetrics[]): StudentIntervention[] {
  const interventions: StudentIntervention[] = [];
  for (const metric of metrics) {
    const instance = metric.instance;
    for (const student of metric.assignedStudents) {
      const attempt = metric.studentAttempts.get(student.id);
      if (!attempt) {
        interventions.push({
          studentId: student.id,
          studentName: student.name,
          instanceId: instance.id,
          instanceTitle: instance.title,
          classId: instance.classId,
          className: instance.class.name,
          attemptCount: 0,
          bestScore: null,
          improvement: null,
          selectedScore: null,
          reason: "not_submitted",
        });
        continue;
      }

      if (attempt.selectedScore !== null && attempt.selectedScore < LOW_SCORE_THRESHOLD) {
        interventions.push({
          studentId: student.id,
          studentName: student.name,
          instanceId: instance.id,
          instanceTitle: instance.title,
          classId: instance.classId,
          className: instance.class.name,
          attemptCount: attempt.attemptCount,
          bestScore: attempt.bestScore,
          improvement: attempt.improvement,
          selectedScore: attempt.selectedScore,
          reason: "low_score",
        });
        continue;
      }

      if (attempt.improvement !== null && attempt.improvement < 0) {
        interventions.push({
          studentId: student.id,
          studentName: student.name,
          instanceId: instance.id,
          instanceTitle: instance.title,
          classId: instance.classId,
          className: instance.class.name,
          attemptCount: attempt.attemptCount,
          bestScore: attempt.bestScore,
          improvement: attempt.improvement,
          selectedScore: attempt.selectedScore,
          reason: "declining",
        });
      }
    }
  }

  return interventions
    .sort((a, b) => {
      const scoreA = a.selectedScore ?? Number.NEGATIVE_INFINITY;
      const scoreB = b.selectedScore ?? Number.NEGATIVE_INFINITY;
      return scoreA - scoreB;
    })
    .slice(0, 50);
}

function buildWeeklyInsight(input: {
  generatedAt: string;
  kpis: AnalyticsV2Diagnosis["kpis"];
  actionItems: ActionItem[];
  chapterDiagnostics: ChapterDiagnostic[];
  quizDiagnostics: QuizQuestionDiagnostic[];
  simulationDiagnostics: RubricCriterionDiagnostic[];
  studentInterventions: StudentIntervention[];
}): WeeklyInsight {
  const highlights: WeeklyInsightItem[] = [];
  const risks: WeeklyInsightItem[] = [];
  const recommendations: WeeklyInsightItem[] = [];

  const activeChapters = input.chapterDiagnostics.filter((chapter) => chapter.instanceCount > 0);
  const strongestChapter = [...activeChapters]
    .filter((chapter) => chapter.avgNormalizedScore !== null)
    .sort((a, b) => (b.avgNormalizedScore ?? 0) - (a.avgNormalizedScore ?? 0))[0];
  const weakestChapter = [...activeChapters].sort((a, b) => {
    const scoreA = a.avgNormalizedScore ?? Number.POSITIVE_INFINITY;
    const scoreB = b.avgNormalizedScore ?? Number.POSITIVE_INFINITY;
    return scoreA - scoreB || (a.completionRate ?? 1) - (b.completionRate ?? 1);
  })[0];
  const topWeakness = activeChapters.flatMap((chapter) => chapter.weaknesses)[0];
  const lowCompletionItem = input.actionItems.find((item) => item.type === "low_completion");
  const lowScoreItem = input.actionItems.find((item) => item.type === "low_score");
  const weakConceptItem = input.actionItems.find((item) => item.type === "weak_concept");
  const weakestQuiz = [...input.quizDiagnostics]
    .filter((row) => row.correctRate !== null || row.avgScoreRate !== null)
    .sort((a, b) => {
      const scoreA = a.correctRate ?? (a.avgScoreRate === null ? 1 : a.avgScoreRate / 100);
      const scoreB = b.correctRate ?? (b.avgScoreRate === null ? 1 : b.avgScoreRate / 100);
      return scoreA - scoreB || a.order - b.order;
    })[0];
  const weakestRubric = input.simulationDiagnostics[0];
  const interventionCounts = countInterventionReasons(input.studentInterventions);

  if (input.kpis.instanceCount === 0) {
    highlights.push({
      id: "no-active-data",
      title: "当前范围暂无可诊断数据",
      detail: "本地洞察没有发现已发布实例或有效提交，可先确认课程、班级、章节和时间筛选。",
      evidence: "实例数 0",
      severity: "info",
    });
  } else {
    highlights.push({
      id: "overall-progress",
      title: "整体进度已汇总",
      detail: `当前范围覆盖 ${input.kpis.instanceCount} 个实例，完成率 ${formatInsightRate(input.kpis.completionRate)}，归一化均分 ${formatInsightPercent(input.kpis.avgNormalizedScore)}。`,
      evidence: `${input.kpis.submittedStudents}/${input.kpis.assignedStudents} 人次完成，${input.kpis.gradedStudents} 人次已评分`,
      severity: "info",
    });
  }

  if (strongestChapter) {
    highlights.push({
      id: "strongest-chapter",
      title: `${strongestChapter.title} 掌握较好`,
      detail: `该章节均分 ${formatInsightPercent(strongestChapter.avgNormalizedScore)}，可作为后续讲评中的正向样例来源。`,
      evidence: `${strongestChapter.submittedStudents}/${strongestChapter.assignedStudents} 人次完成`,
      severity: "info",
    });
  }

  if (lowCompletionItem) {
    risks.push({
      id: "risk-low-completion",
      title: "存在未完成风险",
      detail: `${lowCompletionItem.title}，建议先确认学生是否知道提交入口、截止时间和补交通道。`,
      evidence: `完成率 ${formatInsightRate(lowCompletionItem.metric)}`,
      severity: "high",
    });
    recommendations.push({
      id: "recommend-completion-followup",
      title: "先补齐未完成学生",
      detail: "按班级点名跟进未完成名单，给出明确补交时间，并在下一节课前检查是否补齐。",
      evidence: "低完成率会影响后续掌握度判断",
      severity: "high",
    });
  }

  if (lowScoreItem || (weakestChapter?.avgNormalizedScore !== null && (weakestChapter?.avgNormalizedScore ?? 100) < LOW_SCORE_THRESHOLD)) {
    const sourceTitle = lowScoreItem?.title ?? `${weakestChapter?.title ?? "当前章节"} 平均分偏低`;
    const metric = lowScoreItem?.metric ?? weakestChapter?.avgNormalizedScore ?? null;
    risks.push({
      id: "risk-low-score",
      title: "存在低掌握风险",
      detail: `${sourceTitle}，说明部分学生还没有稳定掌握本轮任务要求。`,
      evidence: `均分 ${formatInsightPercent(metric)}`,
      severity: "medium",
    });
    recommendations.push({
      id: "recommend-short-reteach",
      title: "安排短讲评和再练习",
      detail: "用 10-15 分钟复盘共性错误，再布置一道同类型小练习，优先观察低掌握学生是否能独立完成。",
      evidence: "均分或章节掌握度低于 60%",
      severity: "medium",
    });
  }

  if (weakConceptItem || topWeakness) {
    const weaknessTitle = weakConceptItem?.title ?? `${topWeakness?.tag ?? "薄弱点"} 需要关注`;
    const count = weakConceptItem?.metric ?? topWeakness?.count ?? 0;
    risks.push({
      id: "risk-weak-concept",
      title: "共性薄弱点已出现",
      detail: `${weaknessTitle}，适合用板书或例题把关键步骤重新拆开。`,
      evidence: `${count} 人次相关信号`,
      severity: "medium",
    });
  }

  if (weakestQuiz && ((weakestQuiz.correctRate ?? 1) < 0.6 || (weakestQuiz.avgScoreRate ?? 100) < LOW_SCORE_THRESHOLD)) {
    recommendations.push({
      id: "recommend-quiz-review",
      title: "针对低正确率题目讲评",
      detail: `优先讲评 Q${weakestQuiz.order}，让学生说明选择依据，再补充一题同考点变式。`,
      evidence: `正确率 ${formatInsightRate(weakestQuiz.correctRate)}，得分率 ${formatInsightPercent(weakestQuiz.avgScoreRate)}`,
      severity: "medium",
    });
  }

  if (weakestRubric && (weakestRubric.avgScoreRate !== null || weakestRubric.lowScoreCount > 0)) {
    recommendations.push({
      id: "recommend-rubric-review",
      title: "用评分维度对齐作答标准",
      detail: `围绕“${weakestRubric.criterionName}”展示一份达标样例和一份待修改样例，帮助学生看清得分要求。`,
      evidence: `低分 ${weakestRubric.lowScoreCount} 人，平均得分率 ${formatInsightPercent(weakestRubric.avgScoreRate)}`,
      severity: "medium",
    });
  }

  if (input.studentInterventions.length > 0) {
    risks.push({
      id: "risk-student-intervention",
      title: "部分学生需要单独跟进",
      detail: "干预名单中包含未完成、低掌握或退步学生，建议按原因分组处理。",
      evidence: `未完成 ${interventionCounts.not_submitted} 人次，低掌握 ${interventionCounts.low_score} 人次，退步 ${interventionCounts.declining} 人次`,
      severity: interventionCounts.not_submitted + interventionCounts.low_score >= 5 ? "high" : "medium",
    });
    recommendations.push({
      id: "recommend-student-groups",
      title: "分组推进学生干预",
      detail: "未完成学生先补交，低掌握学生做订正和二次练习，退步学生单独询问最近学习卡点。",
      evidence: `${input.studentInterventions.length} 条干预记录`,
      severity: "medium",
    });
  }

  if (risks.length === 0) {
    risks.push({
      id: "risk-none",
      title: "暂未发现明显风险",
      detail: "当前完成率、得分和干预信号没有触发高风险阈值，可继续保持常规检查。",
      evidence: "本地规则未触发低完成、低掌握或退步风险",
      severity: "info",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "recommend-maintain",
      title: "保持当前教学节奏",
      detail: "继续用短测或课堂练习跟踪掌握情况，下一次诊断重点观察是否有新增薄弱点。",
      evidence: "当前范围暂无高优先级行动项",
      severity: "info",
    });
  }

  return {
    generatedAt: input.generatedAt,
    mode: "local_fallback",
    label: "本地生成/待 AI 增强",
    highlights: highlights.slice(0, 3),
    risks: risks.slice(0, 4),
    recommendations: recommendations.slice(0, 4),
  };
}

function buildAnalyticsTrends(
  metrics: InstanceMetrics[],
  range: AnalyticsV2Range,
  generatedAt: string,
): AnalyticsV2Trends {
  return {
    generatedAt,
    range,
    chapterTrend: buildChapterTrend(metrics),
    classTrend: buildClassTrend(metrics),
    studentGrowth: buildStudentGrowth(metrics),
  };
}

function buildChapterTrend(metrics: InstanceMetrics[]): ChapterTrendPoint[] {
  const grouped = new Map<string, InstanceMetrics[]>();
  for (const metric of metrics) {
    const key = metric.instance.chapterId ?? "unassigned";
    const rows = grouped.get(key) ?? [];
    rows.push(metric);
    grouped.set(key, rows);
  }

  return Array.from(grouped.values())
    .map((rows) => {
      const first = rows[0].instance;
      const assignedStudents = sum(rows.map((row) => row.assignedCount));
      const submittedStudents = sum(rows.map((row) => row.submittedCount));
      return {
        chapterId: first.chapterId,
        title: first.chapter?.title ?? "未关联章节",
        order: first.chapter?.order ?? null,
        instanceCount: rows.length,
        completionRate: rate(submittedStudents, assignedStudents),
        avgNormalizedScore: average(rows.flatMap((row) => row.scores)),
        latestActivityAt: latestIso(rows.map((row) => getInstanceActivityAt(row.instance))),
      };
    })
    .filter((row) => row.instanceCount > 0)
    .sort((a, b) => {
      const orderA = a.order ?? Number.POSITIVE_INFINITY;
      const orderB = b.order ?? Number.POSITIVE_INFINITY;
      return orderA - orderB || compareNullableIso(b.latestActivityAt, a.latestActivityAt) || a.title.localeCompare(b.title, "zh-CN");
    });
}

function buildClassTrend(metrics: InstanceMetrics[]): ClassTrendPoint[] {
  const grouped = new Map<string, InstanceMetrics[]>();
  for (const metric of metrics) {
    const rows = grouped.get(metric.instance.classId) ?? [];
    rows.push(metric);
    grouped.set(metric.instance.classId, rows);
  }

  return Array.from(grouped.values())
    .map((rows) => {
      const first = rows[0].instance;
      const assignedStudents = sum(rows.map((row) => row.assignedCount));
      const submittedStudents = sum(rows.map((row) => row.submittedCount));
      return {
        classId: first.classId,
        className: first.class.name,
        instanceCount: rows.length,
        assignedStudents,
        submittedStudents,
        completionRate: rate(submittedStudents, assignedStudents),
        avgNormalizedScore: average(rows.flatMap((row) => row.scores)),
        latestActivityAt: latestIso(rows.map((row) => getInstanceActivityAt(row.instance))),
      };
    })
    .sort((a, b) => compareNullableIso(b.latestActivityAt, a.latestActivityAt) || a.className.localeCompare(b.className, "zh-CN"));
}

function buildStudentGrowth(metrics: InstanceMetrics[]): StudentGrowthPoint[] {
  const byStudent = new Map<
    string,
    {
      studentId: string;
      studentName: string;
      classId: string;
      className: string;
      selectedScores: number[];
      scoredAttempts: Array<{ id: string; score: number; submittedAt: Date | string }>;
      attemptCount: number;
      completedInstances: number;
    }
  >();

  for (const metric of metrics) {
    const assignedById = new Map(metric.assignedStudents.map((student) => [student.id, student]));
    for (const [studentId, attempt] of metric.studentAttempts.entries()) {
      const student = assignedById.get(studentId);
      if (!student) continue;
      const row = byStudent.get(studentId) ?? {
        studentId,
        studentName: student.name,
        classId: metric.instance.classId,
        className: metric.instance.class.name,
        selectedScores: [],
        scoredAttempts: [],
        attemptCount: 0,
        completedInstances: 0,
      };
      row.attemptCount += attempt.attemptCount;
      if (attempt.selectedScore !== null) {
        row.selectedScores.push(attempt.selectedScore);
        row.completedInstances += 1;
      }
      byStudent.set(studentId, row);
    }

    const assignedIds = new Set(metric.assignedStudents.map((student) => student.id));
    for (const submission of metric.instance.submissions) {
      if (!assignedIds.has(submission.studentId)) continue;
      if (submission.status !== "graded") continue;
      const score = normalizeScore(submission.score, submission.maxScore);
      if (score === null) continue;
      const student = assignedById.get(submission.studentId);
      if (!student) continue;
      const row = byStudent.get(submission.studentId) ?? {
        studentId: submission.studentId,
        studentName: student.name,
        classId: metric.instance.classId,
        className: metric.instance.class.name,
        selectedScores: [],
        scoredAttempts: [],
        attemptCount: 0,
        completedInstances: 0,
      };
      row.scoredAttempts.push({ id: submission.id, score, submittedAt: submission.submittedAt });
      byStudent.set(submission.studentId, row);
    }
  }

  return Array.from(byStudent.values())
    .filter((row) => row.attemptCount > 0)
    .map((row) => {
      const scoredAttempts = [...row.scoredAttempts].sort((a, b) => compareSubmittedAt(a, b));
      const first = scoredAttempts[0];
      const latest = scoredAttempts[scoredAttempts.length - 1];
      return {
        studentId: row.studentId,
        studentName: row.studentName,
        classId: row.classId,
        className: row.className,
        selectedScore: average(row.selectedScores),
        bestScore:
          scoredAttempts.length > 0
            ? Math.max(...scoredAttempts.map((attempt) => attempt.score))
            : null,
        improvement:
          first && latest && scoredAttempts.length >= 2
            ? round1(latest.score - first.score)
            : null,
        attemptCount: row.attemptCount,
        completedInstances: row.completedInstances,
        firstSubmittedAt: first ? toIso(first.submittedAt) : null,
        latestSubmittedAt: latest ? toIso(latest.submittedAt) : null,
      };
    })
    .sort((a, b) => {
      const improvementDelta = (b.improvement ?? Number.NEGATIVE_INFINITY) - (a.improvement ?? Number.NEGATIVE_INFINITY);
      if (improvementDelta !== 0) return improvementDelta;
      return compareNullableIso(b.latestSubmittedAt, a.latestSubmittedAt) || a.studentName.localeCompare(b.studentName, "zh-CN");
    })
    .slice(0, 50);
}

function buildQuizDiagnostics(metrics: InstanceMetrics[]): QuizQuestionDiagnostic[] {
  const diagnostics: QuizQuestionDiagnostic[] = [];

  for (const metric of metrics) {
    if (metric.instance.taskType !== "quiz") continue;
    const questions = metric.instance.task.quizQuestions;
    if (questions.length === 0) continue;

    const selectedSubmissions = getSelectedDiagnosisSubmissions(metric).filter(
      (submission) => submission.quizSubmission,
    );
    if (selectedSubmissions.length === 0) continue;

    for (const question of questions) {
      const scoreRates: number[] = [];
      const weakTagCounts = new Map<string, number>();
      let correctCount = 0;
      let unansweredCount = 0;

      for (const submission of selectedSubmissions) {
        const breakdown = getQuizBreakdown(getEvaluation(submission));
        const row = breakdown.find((item) => item.questionId === question.id);
        if (!row) {
          unansweredCount += 1;
          continue;
        }

        if (row.correct === true) correctCount += 1;
        if (isUnansweredQuizRow(row)) unansweredCount += 1;

        const rowScoreRate = normalizeScore(row.score, row.maxScore);
        if (rowScoreRate !== null) scoreRates.push(rowScoreRate);
        if (row.correct === false || (rowScoreRate !== null && rowScoreRate < LOW_SCORE_THRESHOLD)) {
          for (const tag of getConceptTags(submission)) {
            weakTagCounts.set(tag, (weakTagCounts.get(tag) ?? 0) + 1);
          }
        }
      }

      diagnostics.push({
        questionId: question.id,
        order: question.order,
        prompt: question.prompt,
        correctRate: rate(correctCount, selectedSubmissions.length),
        unansweredRate: rate(unansweredCount, selectedSubmissions.length),
        avgScoreRate: average(scoreRates),
        weakTags: Array.from(weakTagCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
          .slice(0, 5)
          .map(([tag]) => tag),
      });
    }
  }

  return diagnostics.sort((a, b) => a.order - b.order || a.questionId.localeCompare(b.questionId));
}

function buildRubricDiagnostics(metrics: InstanceMetrics[]): RubricCriterionDiagnostic[] {
  const byCriterion = new Map<
    string,
    {
      criterionId: string;
      criterionName: string;
      scoreRates: number[];
      weakStudents: Map<string, string>;
      sampleComments: string[];
    }
  >();

  for (const metric of metrics) {
    if (metric.instance.taskType !== "simulation" && metric.instance.taskType !== "subjective") continue;
    const criteria = metric.instance.task.scoringCriteria;
    if (criteria.length === 0) continue;

    const selectedSubmissions = getSelectedDiagnosisSubmissions(metric);
    if (selectedSubmissions.length === 0) continue;

    for (const criterion of criteria) {
      const row = byCriterion.get(criterion.id) ?? {
        criterionId: criterion.id,
        criterionName: criterion.name,
        scoreRates: [],
        weakStudents: new Map<string, string>(),
        sampleComments: [],
      };

      for (const submission of selectedSubmissions) {
        const breakdown = getRubricBreakdown(getEvaluation(submission));
        const item = breakdown.find((entry) => entry.criterionId === criterion.id);
        if (!item) continue;

        const scoreRate = normalizeScore(item.score, item.maxScore);
        if (scoreRate !== null) row.scoreRates.push(scoreRate);
        if (scoreRate !== null && scoreRate < LOW_SCORE_THRESHOLD) {
          row.weakStudents.set(submission.student.id, submission.student.name);
          if (item.comment && row.sampleComments.length < 3) {
            row.sampleComments.push(item.comment);
          }
        }
      }

      byCriterion.set(criterion.id, row);
    }
  }

  return Array.from(byCriterion.values())
    .map((row) => ({
      criterionId: row.criterionId,
      criterionName: row.criterionName,
      avgScoreRate: average(row.scoreRates),
      lowScoreCount: row.weakStudents.size,
      weakStudents: Array.from(row.weakStudents.entries())
        .map(([studentId, studentName]) => ({ studentId, studentName }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName, "zh-CN") || a.studentId.localeCompare(b.studentId))
        .slice(0, 8),
      sampleComments: row.sampleComments,
    }))
    .filter((row) => row.avgScoreRate !== null || row.lowScoreCount > 0)
    .sort((a, b) => {
      const scoreA = a.avgScoreRate ?? Number.POSITIVE_INFINITY;
      const scoreB = b.avgScoreRate ?? Number.POSITIVE_INFINITY;
      return scoreA - scoreB || b.lowScoreCount - a.lowScoreCount || a.criterionName.localeCompare(b.criterionName, "zh-CN");
    });
}

function getSelectedDiagnosisSubmissions(metric: InstanceMetrics): DiagnosisSubmission[] {
  const submissions: DiagnosisSubmission[] = [];
  for (const attempt of metric.studentAttempts.values()) {
    if (!attempt.selectedSubmission) continue;
    submissions.push(attempt.selectedSubmission as DiagnosisSubmission);
  }
  return submissions;
}

interface QuizBreakdownRow {
  questionId: string;
  score: number | string | Prisma.Decimal | null;
  maxScore: number | string | Prisma.Decimal | null;
  correct: boolean | null;
  comment: string | null;
}

interface RubricBreakdownRow {
  criterionId: string;
  score: number | string | Prisma.Decimal | null;
  maxScore: number | string | Prisma.Decimal | null;
  comment: string | null;
}

function getQuizBreakdown(evaluation: unknown): QuizBreakdownRow[] {
  return getArrayField(evaluation, "quizBreakdown")
    .map((row) => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;
      const questionId = typeof record.questionId === "string" ? record.questionId : null;
      if (!questionId) return null;
      return {
        questionId,
        score: numericJsonField(record.score),
        maxScore: numericJsonField(record.maxScore),
        correct: typeof record.correct === "boolean" ? record.correct : null,
        comment: typeof record.comment === "string" ? record.comment : null,
      };
    })
    .filter((row): row is QuizBreakdownRow => row !== null);
}

function getRubricBreakdown(evaluation: unknown): RubricBreakdownRow[] {
  return getArrayField(evaluation, "rubricBreakdown")
    .map((row) => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;
      const criterionId = typeof record.criterionId === "string" ? record.criterionId : null;
      if (!criterionId) return null;
      return {
        criterionId,
        score: numericJsonField(record.score),
        maxScore: numericJsonField(record.maxScore),
        comment: typeof record.comment === "string" ? record.comment : null,
      };
    })
    .filter((row): row is RubricBreakdownRow => row !== null);
}

function numericJsonField(value: unknown): number | string | Prisma.Decimal | null {
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return value as Prisma.Decimal;
  }
  return null;
}

function isUnansweredQuizRow(row: QuizBreakdownRow): boolean {
  if (normalizeScore(row.score, row.maxScore) === 0 && row.comment?.includes("未作答")) return true;
  return row.comment?.trim() === "未作答";
}

function topWeaknesses(metrics: InstanceMetrics[]) {
  const counts = new Map<string, Set<string>>();
  for (const metric of metrics) {
    for (const [tag, students] of metric.weaknesses.entries()) {
      const set = counts.get(tag) ?? new Set<string>();
      for (const studentId of students) set.add(studentId);
      counts.set(tag, set);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, students]) => ({ tag, count: students.size }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"))
    .slice(0, 10);
}

function getDateFromRange(range: AnalyticsV2Range, now: Date): Date | null {
  if (range === "term") return null;
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function countInterventionReasons(rows: StudentIntervention[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.reason] += 1;
      return acc;
    },
    { not_submitted: 0, low_score: 0, declining: 0 },
  );
}

function formatInsightRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "无";
  return `${round1(value * 100)}%`;
}

function formatInsightPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "无";
  return `${round1(value)}%`;
}

function getInstanceActivityAt(instance: DiagnosisInstance): Date | string | null {
  return latestIso([
    instance.publishedAt,
    instance.publishAt,
    instance.createdAt,
    ...instance.submissions.map((submission) => submission.submittedAt),
  ]);
}

function latestIso(values: Array<Date | string | null | undefined>): string | null {
  const valid = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid)).toISOString();
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function getConceptTags(submission: {
  simulationSubmission?: SubmissionDetail | null;
  quizSubmission?: SubmissionDetail | null;
  subjectiveSubmission?: SubmissionDetail | null;
}): string[] {
  const tags =
    submission.simulationSubmission?.conceptTags ??
    submission.quizSubmission?.conceptTags ??
    submission.subjectiveSubmission?.conceptTags ??
    [];
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function getEvaluation(submission: {
  simulationSubmission?: SubmissionDetail | null;
  quizSubmission?: SubmissionDetail | null;
  subjectiveSubmission?: SubmissionDetail | null;
}): unknown {
  return (
    submission.simulationSubmission?.evaluation ??
    submission.quizSubmission?.evaluation ??
    submission.subjectiveSubmission?.evaluation ??
    null
  );
}

function hasWrongQuizAnswer(evaluation: unknown): boolean {
  const breakdown = getArrayField(evaluation, "quizBreakdown");
  return breakdown.some((row) => {
    if (typeof row !== "object" || row === null) return false;
    const record = row as Record<string, unknown>;
    if (record.correct === false) return true;
    return isLowComponentScore(record);
  });
}

function hasLowRubricScore(evaluation: unknown): boolean {
  const breakdown = getArrayField(evaluation, "rubricBreakdown");
  return breakdown.some((row) => {
    if (typeof row !== "object" || row === null) return false;
    return isLowComponentScore(row as Record<string, unknown>);
  });
}

function isLowComponentScore(record: Record<string, unknown>): boolean {
  const score = typeof record.score === "number" ? record.score : Number(record.score);
  const maxScore = typeof record.maxScore === "number" ? record.maxScore : Number(record.maxScore);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return false;
  return (score / maxScore) * 100 < LOW_SCORE_THRESHOLD;
}

function hasExplicitWeaknessFeedback(evaluation: unknown): boolean {
  if (typeof evaluation !== "object" || evaluation === null) return false;
  const feedback = (evaluation as Record<string, unknown>).feedback;
  if (typeof feedback !== "string") return false;
  const normalizedFeedback = feedback.replace(/\s+/g, "");
  if (
    /(?:没有|无|未发现|不存在)(?:明显)?(?:错误|薄弱|不足|欠缺|混淆|问题)/.test(
      normalizedFeedback,
    )
  ) {
    return false;
  }
  return /错误|薄弱|不足|不理解|未掌握|需要改进|欠缺|混淆|incorrect|wrong|weak|struggle|needs improvement/i.test(
    feedback,
  );
}

function getArrayField(value: unknown, field: string): unknown[] {
  if (typeof value !== "object" || value === null) return [];
  const fieldValue = (value as Record<string, unknown>)[field];
  return Array.isArray(fieldValue) ? fieldValue : [];
}

function groupByStudent<T extends { studentId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const values = grouped.get(row.studentId) ?? [];
    values.push(row);
    grouped.set(row.studentId, values);
  }
  return grouped;
}

function compareSubmittedAt(
  a: { id: string; submittedAt: Date | string },
  b: { id: string; submittedAt: Date | string },
): number {
  const delta = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

function compareStudentName(a: StudentRef, b: StudentRef): number {
  return a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);
}

function compareNullableIso(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((acc, value) => acc + value, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const result =
    sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  return round1(result);
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round3(numerator / denominator);
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
