// PR-STU-1 · 学生 /grades 重布局：纯数据 transforms（无副作用、可测）
// 数据流：GET /api/submissions + GET /api/lms/dashboard/summary（client-side join）
//
// 防作弊（D1）：仅"已公布"submission（analysisStatus === "released"）参与平均分/by-type 聚合。
// 客户端兜底派生 deriveAnalysisStatus 已在 components/instance-detail/submissions-utils.ts。

import type { SubmissionAnalysisStatus } from "@/components/instance-detail/submissions-utils";

export type GradesTaskType = "simulation" | "quiz" | "subjective";

export interface GradeRow {
  id: string;
  taskId: string;
  taskInstanceId: string;
  taskType: GradesTaskType | string;
  status: string;
  score: number | null;
  maxScore: number | null;
  evaluation: Record<string, unknown> | null;
  submittedAt: string;
  gradedAt: string | null;
  releasedAt: string | null;
  analysisStatus: SubmissionAnalysisStatus;
  taskName: string;
  /** 实例标题（fallback 到 taskName）*/
  instanceTitle: string;
  /** 课程名 — 通过 taskInstanceId 在 dashboard summary.tasks join 派生，可能为 null */
  courseName: string | null;
  /** 课程 id — 用于 courseColorForId tag 色派生 */
  courseId: string | null;
  /**
   * PR-15 bug 6a: criterion id → name 映射的真源
   * `evaluation.rubricBreakdown[].criterionId` 是 ScoringCriterion.id (CUID)；
   * panel 用此数组建 Map 显示中文 name 而非 CUID。getSubmissions include 透传。
   * 教师 list 等 caller 不读，多余字段不影响。
   */
  scoringCriteria: Array<{ id: string; name: string; maxPoints: number }> | null;
  /**
   * PR-15 bug 6b: 模拟对话 transcript（来自 SimulationSubmission.transcript Json）。
   * defensive filter: 只保留 role ∈ {student, ai} 且 text 非空字符串的消息，
   * 防 schema drift (mood 8 档新增、AI 返不规则 payload) 让 UI 不爆。
   * TODO: PR-2 候选 B (lib/validators/transcript.schema.ts) 落地后用 schema.parse 替换 defensive filter。
   */
  transcript: Array<{
    id?: string;
    role: 'student' | 'ai';
    text: string;
    timestamp?: string;
  }> | null;
}

export interface ByTypeStat {
  type: GradesTaskType;
  label: string;
  /** 平均百分比；无已公布提交则 null */
  avgPercent: number | null;
  /** 已公布提交数（聚合分母） */
  releasedCount: number;
  /** 近 5 次每次的 percent；用于 mini bar */
  recentPercents: number[];
}

export interface GradesHeaderStats {
  totalCount: number;
  releasedCount: number;
  avgPercent: number;
  /** 仅当 releasedCount > 0 时有效；否则 0 占位 */
}

const TYPE_LABEL: Record<GradesTaskType, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const TYPES: GradesTaskType[] = ["simulation", "quiz", "subjective"];

/** percent = score / maxScore × 100，四舍五入。无效输入返回 null。 */
export function computePercent(
  score: number | null,
  maxScore: number | null,
): number | null {
  if (score == null || maxScore == null || maxScore <= 0) return null;
  return Math.round((score / maxScore) * 100);
}

/**
 * 用于 hero 卡 + by-type 卡的"已公布"过滤器：
 * D1 防作弊语义 — 仅 analysisStatus === "released" 且 score 非空才计入聚合。
 */
export function filterReleased(rows: GradeRow[]): GradeRow[] {
  return rows.filter(
    (r) => r.analysisStatus === "released" && r.score !== null,
  );
}

/** 计算 hero 卡的 3 数（总提交 / 已公布 / 已公布平均分%）。 */
export function buildHeaderStats(rows: GradeRow[]): GradesHeaderStats {
  const released = filterReleased(rows);
  const totalCount = rows.length;
  const releasedCount = released.length;
  if (releasedCount === 0) {
    return { totalCount, releasedCount, avgPercent: 0 };
  }
  const sum = released.reduce((acc, r) => {
    const p = computePercent(r.score, r.maxScore);
    return acc + (p ?? 0);
  }, 0);
  return {
    totalCount,
    releasedCount,
    avgPercent: Math.round(sum / releasedCount),
  };
}

/** 按 taskType 聚合：3 行（simulation/quiz/subjective），含近 5 次 percent。 */
export function buildByTypeStats(rows: GradeRow[]): ByTypeStat[] {
  // 已公布、按 submittedAt desc 排序的全集
  const released = filterReleased(rows).slice().sort((a, b) => {
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
  return TYPES.map((type) => {
    const ofType = released.filter((r) => r.taskType === type);
    const avgPercent = ofType.length === 0
      ? null
      : Math.round(
          ofType.reduce((acc, r) => acc + (computePercent(r.score, r.maxScore) ?? 0), 0) /
            ofType.length,
        );
    // 近 5 次：按时间最新的 5 条（已 desc 排），转回 asc 显示成趋势
    const recentPercents = ofType
      .slice(0, 5)
      .map((r) => computePercent(r.score, r.maxScore) ?? 0)
      .reverse();
    return {
      type,
      label: TYPE_LABEL[type],
      avgPercent,
      releasedCount: ofType.length,
      recentPercents,
    };
  });
}

export type GradesTabKey = "all" | GradesTaskType;

/** 各 tab 的计数（用于 tab 上的徽章）。 */
export function buildTabCounts(rows: GradeRow[]): Record<GradesTabKey, number> {
  return {
    all: rows.length,
    simulation: rows.filter((r) => r.taskType === "simulation").length,
    quiz: rows.filter((r) => r.taskType === "quiz").length,
    subjective: rows.filter((r) => r.taskType === "subjective").length,
  };
}

/** Tab 过滤；不改变排序。 */
export function filterByTab(rows: GradeRow[], tab: GradesTabKey): GradeRow[] {
  if (tab === "all") return rows;
  return rows.filter((r) => r.taskType === tab);
}

/**
 * 按"已公布的同类型最近一次"做 trend：
 * 当前行 percent 减去上一次同 taskType 的 percent。
 * 仅对 released 行返回数字；其余 null。
 */
export function buildTrendMap(rows: GradeRow[]): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  // 全集按时间 asc 排序，逐 type 维护 last percent
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );
  const lastByType: Record<string, number> = {};
  for (const r of sorted) {
    if (r.analysisStatus !== "released" || r.score === null) {
      result[r.id] = null;
      continue;
    }
    const p = computePercent(r.score, r.maxScore);
    if (p == null) {
      result[r.id] = null;
      continue;
    }
    const prev = lastByType[r.taskType];
    result[r.id] = prev === undefined ? null : p - prev;
    lastByType[r.taskType] = p;
  }
  return result;
}

/**
 * 客户端 join：把 dashboard summary 里的 task → course 信息落到 submission 上。
 * 两个 endpoint 同步偏差时：courseName/Id 缺失 → null（页面 UI 优雅 fallback）。
 *
 * - rawSubmissions：GET /api/submissions 原始 items（已含后端透传 analysisStatus / releasedAt）
 * - tasks：GET /api/lms/dashboard/summary 的 tasks（含 course.id/courseTitle）
 */
export interface RawSubmissionLite {
  id: string;
  taskId: string;
  taskInstanceId: string;
  taskType: string;
  status: string;
  score: number | string | null;
  maxScore: number | string | null;
  /**
   * Fix 6 修订：Submission 本身没有 evaluation 字段（prisma schema 表 16）。
   * evaluation 在三个嵌套表上（simulationSubmission / quizSubmission / subjectiveSubmission），
   * `/api/submissions` 透传这些嵌套对象，joinSubmissions 据此挑出当前 taskType 的那个。
   * 此处保留可选字段供向后兼容（旧 mock 测试可能直接传顶层 evaluation）。
   */
  evaluation?: Record<string, unknown> | null;
  simulationSubmission?: { evaluation?: Record<string, unknown> | null } | null;
  quizSubmission?: { evaluation?: Record<string, unknown> | null } | null;
  subjectiveSubmission?: { evaluation?: Record<string, unknown> | null } | null;
  submittedAt: string;
  gradedAt: string | null;
  releasedAt?: string | null;
  analysisStatus?: SubmissionAnalysisStatus;
  task?: {
    id?: string;
    taskName?: string;
    taskType?: string;
    /** PR-15 bug 6a: getSubmissions include 透传 — Joiner 用 c.id → c.name */
    scoringCriteria?: Array<{ id: string; name: string; maxPoints: number; order?: number }>;
  };
  taskInstance?: { id?: string; title?: string };
}

export interface TaskInstanceLite {
  id: string;
  title?: string;
  course?: { id?: string; courseTitle?: string } | null;
}

export function joinSubmissions(
  rawSubmissions: RawSubmissionLite[],
  taskInstances: TaskInstanceLite[],
): GradeRow[] {
  const tiMap = new Map<string, TaskInstanceLite>();
  for (const ti of taskInstances) {
    if (ti.id) tiMap.set(ti.id, ti);
  }
  return rawSubmissions.map((s) => {
    const ti = tiMap.get(s.taskInstanceId);
    const courseName = ti?.course?.courseTitle ?? null;
    const courseId = ti?.course?.id ?? null;
    const taskName = s.task?.taskName ?? "";
    const instanceTitle = ti?.title ?? s.taskInstance?.title ?? taskName;
    const score = s.score == null ? null : Number(s.score);
    const maxScore = s.maxScore == null ? null : Number(s.maxScore);
    const releasedAt = s.releasedAt ?? null;
    // 兜底（与 submissions-utils.deriveAnalysisStatus 同步）
    let analysisStatus: SubmissionAnalysisStatus = s.analysisStatus ?? "pending";
    if (!s.analysisStatus) {
      if (s.status === "graded" && releasedAt) analysisStatus = "released";
      else if (s.status === "graded") analysisStatus = "analyzed_unreleased";
      else analysisStatus = "pending";
    }
    // PR-15 bug 6a: criterion.id → name 真源 (CUID 不再显示给学生)
    const scoringCriteria = Array.isArray(s.task?.scoringCriteria)
      ? s.task!.scoringCriteria.map((c) => ({
          id: c.id,
          name: c.name,
          maxPoints: c.maxPoints,
        }))
      : null;
    // PR-15 bug 6b: transcript defensive filter — 只保留 schema 兼容的对话消息
    const rawTranscript = (s.simulationSubmission as { transcript?: unknown } | null | undefined)
      ?.transcript;
    const transcript = Array.isArray(rawTranscript)
      ? (rawTranscript as Array<Record<string, unknown>>)
          .filter(
            (m) =>
              m &&
              typeof m === 'object' &&
              typeof (m as { text?: unknown }).text === 'string' &&
              ((m as { role?: unknown }).role === 'student' ||
                (m as { role?: unknown }).role === 'ai'),
          )
          .map((m) => ({
            id: typeof m.id === 'string' ? m.id : undefined,
            role: m.role as 'student' | 'ai',
            text: m.text as string,
            timestamp: typeof m.timestamp === 'string' ? m.timestamp : undefined,
          }))
      : null;
    return {
      id: s.id,
      taskId: s.taskId,
      taskInstanceId: s.taskInstanceId,
      taskType: s.taskType,
      status: s.status,
      score,
      maxScore,
      evaluation:
        s.simulationSubmission?.evaluation ??
        s.subjectiveSubmission?.evaluation ??
        s.quizSubmission?.evaluation ??
        s.evaluation ??
        null,
      submittedAt: s.submittedAt,
      gradedAt: s.gradedAt,
      releasedAt,
      analysisStatus,
      taskName,
      instanceTitle,
      courseName,
      courseId,
      scoringCriteria,
      transcript,
    };
  });
}

/** 分数颜色档位：>=90 success / >=75 primary / >=60 warn / <60 danger / null ink5。 */
export type ScoreTone = "success" | "primary" | "warn" | "danger" | "muted";
export function scoreTone(percent: number | null): ScoreTone {
  if (percent == null) return "muted";
  if (percent >= 90) return "success";
  if (percent >= 75) return "primary";
  if (percent >= 60) return "warn";
  return "danger";
}
