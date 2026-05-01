export type SubmissionStatus = "submitted" | "grading" | "graded" | "failed";
export type SubmissionFilterKey = "all" | "submitted" | "grading" | "graded" | "failed";
export type SubmissionSortKey = "score-desc" | "score-asc" | "time-desc" | "time-asc" | "name";

// PR-SIM-1b · D1 教师视角的"分析状态"标签（来源 lib/services/submission.service.ts 派生函数）
// pending = AI 还没分析完 / 失败
// analyzed_unreleased = AI 已出分但教师还没公布给学生
// released = 学生已可见
export type SubmissionAnalysisStatus = "pending" | "analyzed_unreleased" | "released";

export interface RubricBreakdownEntry {
  criterionId: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface SubmissionEvaluation {
  totalScore?: number;
  maxScore?: number;
  feedback?: string;
  rubricBreakdown?: RubricBreakdownEntry[];
  confidence?: number;
}

export interface NormalizedSubmission {
  id: string;
  studentId: string;
  studentName: string;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  aiScore: number | null;
  submittedAt: string;
  gradedAt: string | null;
  durationSeconds: number | null;
  taskType: "simulation" | "quiz" | "subjective" | string;
  evaluation: SubmissionEvaluation | null;
  attachments?: Array<{ id: string; fileName: string; filePath: string; fileSize: number; contentType: string }>;
  // PR-SIM-1b · D1 后端透传 / 派生
  releasedAt: string | null;
  analysisStatus: SubmissionAnalysisStatus;
}

interface RawSubmission {
  id: string;
  studentId?: string;
  status: string;
  score: number | string | null;
  maxScore: number | string | null;
  submittedAt: string;
  gradedAt: string | null;
  taskType?: string;
  student: { id: string; name: string };
  task?: { id: string; taskName: string; taskType?: string };
  simulationSubmission?: { evaluation?: unknown } | null;
  quizSubmission?: { evaluation?: unknown; durationSeconds?: number | null } | null;
  subjectiveSubmission?: {
    evaluation?: unknown;
    attachments?: Array<{ id: string; fileName: string; filePath: string; fileSize: number; contentType: string }>;
  } | null;
  releasedAt?: string | null;
  analysisStatus?: SubmissionAnalysisStatus;
}

/**
 * PR-SIM-1b · D1 客户端兜底派生（后端 GET /submissions 已附 analysisStatus，
 * 这里仅作 fallback；规则与 lib/services/submission.service.ts deriveAnalysisStatus 同步）
 */
export function deriveAnalysisStatus(args: {
  status: string;
  releasedAt: string | Date | null | undefined;
}): SubmissionAnalysisStatus {
  if (args.status === "graded" && args.releasedAt) return "released";
  if (args.status === "graded") return "analyzed_unreleased";
  return "pending";
}

function pickEvaluation(s: RawSubmission): SubmissionEvaluation | null {
  const candidate =
    (s.simulationSubmission?.evaluation as SubmissionEvaluation | undefined) ??
    (s.quizSubmission?.evaluation as SubmissionEvaluation | undefined) ??
    (s.subjectiveSubmission?.evaluation as SubmissionEvaluation | undefined);
  return candidate ?? null;
}

export function normalizeSubmission(s: RawSubmission): NormalizedSubmission {
  const evaluation = pickEvaluation(s);
  const releasedAt = s.releasedAt ?? null;
  const analysisStatus =
    s.analysisStatus ?? deriveAnalysisStatus({ status: s.status, releasedAt });
  return {
    id: s.id,
    studentId: s.student.id,
    studentName: s.student.name,
    status: s.status as SubmissionStatus,
    score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
    maxScore: s.maxScore !== null && s.maxScore !== undefined ? Number(s.maxScore) : null,
    aiScore: typeof evaluation?.totalScore === "number" ? evaluation.totalScore : null,
    submittedAt: s.submittedAt,
    gradedAt: s.gradedAt,
    durationSeconds: s.quizSubmission?.durationSeconds ?? null,
    taskType: (s.taskType ?? s.task?.taskType ?? "") as NormalizedSubmission["taskType"],
    evaluation,
    attachments: s.subjectiveSubmission?.attachments,
    releasedAt,
    analysisStatus,
  };
}

export function filterSubmissions(
  rows: NormalizedSubmission[],
  status: SubmissionFilterKey,
  query: string
): NormalizedSubmission[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q && !r.studentName.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortSubmissions(
  rows: NormalizedSubmission[],
  sort: SubmissionSortKey
): NormalizedSubmission[] {
  const out = [...rows];
  switch (sort) {
    case "score-desc":
      out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      break;
    case "score-asc":
      out.sort((a, b) => (a.score ?? Number.MAX_SAFE_INTEGER) - (b.score ?? Number.MAX_SAFE_INTEGER));
      break;
    case "time-desc":
      out.sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      break;
    case "time-asc":
      out.sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );
      break;
    case "name":
      out.sort((a, b) => a.studentName.localeCompare(b.studentName, "zh-CN"));
      break;
  }
  return out;
}

export function statusCounts(rows: NormalizedSubmission[]) {
  const c = { all: rows.length, submitted: 0, grading: 0, graded: 0, failed: 0 } as Record<SubmissionFilterKey, number>;
  for (const r of rows) {
    if (r.status === "submitted") c.submitted++;
    else if (r.status === "grading") c.grading++;
    else if (r.status === "graded") c.graded++;
    else if (r.status === "failed") c.failed++;
  }
  return c;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return "-";
  const m = Math.floor(seconds / 60);
  if (m < 1) return `<1 分钟`;
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} 小时` : `${h}h${rem}m`;
}

export function scoreDiff(teacherScore: number | null, aiScore: number | null): number | null {
  if (teacherScore == null || aiScore == null) return null;
  return teacherScore - aiScore;
}
