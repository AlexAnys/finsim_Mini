import { prisma } from "@/lib/db/prisma";
import type { Prisma, TaskType } from "@prisma/client";

export type AnalyticsV2ScorePolicy = "latest" | "best" | "first";
export type AnalyticsV2Range = "7d" | "30d" | "term";

export interface AnalyticsV2DiagnosisInput {
  courseId: string;
  chapterId?: string;
  sectionId?: string;
  classId?: string;
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
    classId: string | null;
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
  };
  chapterClassHeatmap: ChapterClassHeatmapRow[];
  actionItems: ActionItem[];
  chapterDiagnostics: ChapterDiagnostic[];
  instanceDiagnostics: InstanceDiagnostic[];
  quizDiagnostics: QuizQuestionDiagnostic[];
  simulationDiagnostics: RubricCriterionDiagnostic[];
  studentInterventions: StudentIntervention[];
  weeklyInsight: {
    generatedAt: string | null;
    highlights: unknown[];
    risks: unknown[];
  };
  trends: unknown[];
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
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const PASS_THRESHOLD = 60;
const LOW_SCORE_THRESHOLD = 60;

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

  return {
    scope: {
      courseId: course.id,
      courseTitle: course.courseTitle,
      chapterId: input.chapterId ?? null,
      sectionId: input.sectionId ?? null,
      classId: input.classId ?? null,
      taskType: input.taskType ?? null,
      taskInstanceId: input.taskInstanceId ?? null,
      scorePolicy,
      range,
      generatedAt: now.toISOString(),
    },
    filterOptions: buildFilterOptions(course, optionInstances),
    kpis: {
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
    },
    chapterClassHeatmap: buildChapterClassHeatmap(instanceMetrics),
    actionItems: buildActionItems(instanceMetrics),
    chapterDiagnostics: buildChapterDiagnostics(course.chapters, instanceMetrics, input.chapterId),
    instanceDiagnostics: instanceMetrics.map(toInstanceDiagnostic),
    quizDiagnostics: buildQuizDiagnostics(instanceMetrics),
    simulationDiagnostics: buildRubricDiagnostics(instanceMetrics),
    studentInterventions: buildStudentInterventions(instanceMetrics),
    weeklyInsight: {
      generatedAt: null,
      highlights: [],
      risks: [],
    },
    trends: [],
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
    ...(input.classId && { classId: input.classId }),
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

function compareSubmittedAt(a: AttemptSubmission, b: AttemptSubmission): number {
  const delta = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

function compareStudentName(a: StudentRef, b: StudentRef): number {
  return a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);
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
