// Pure data transforms for the teacher dashboard.
// Kept framework-free so they can be unit-tested without React / Next.

export type TeacherTaskType = "simulation" | "quiz" | "subjective";

/* eslint-disable @typescript-eslint/no-explicit-any */
type RawTaskInstance = Record<string, any>;
type RawSubmission = Record<string, any>;
type RawScheduleSlot = Record<string, any>;
type RawCourse = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================
// KPI computations
// ============================================

export interface KpiSummary {
  classCount: number;
  studentCount: number;
  submittedThisWeek: number;
  completionRate: number | null; // 0-100 or null if no baseline
  pendingCount: number;
  avgScore: number | null;
  avgScoreDelta: number | null;
  weakInstanceCount: number;
}

export function buildKpiSummary(args: {
  courses: RawCourse[];
  taskInstances: RawTaskInstance[];
  recentSubmissions: RawSubmission[];
  statsPendingCount: number;
  now?: Date;
}): KpiSummary {
  const now = args.now ?? new Date();
  const weekStart = startOfWeek(now);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const classIds = new Set<string>();
  let studentCount = 0;
  for (const c of args.courses) {
    if (c.class?.id) classIds.add(String(c.class.id));
    const nested = c.classes;
    if (Array.isArray(nested)) {
      for (const cc of nested) {
        if (cc?.class?.id) classIds.add(String(cc.class.id));
      }
    }
  }
  for (const ti of args.taskInstances) {
    const n = Number(ti.class?._count?.students);
    if (Number.isFinite(n) && n > studentCount) studentCount = n;
  }

  const thisWeekSubs = args.recentSubmissions.filter((s) => {
    const ts = s.submittedAt ? new Date(s.submittedAt).getTime() : 0;
    return ts >= weekStart.getTime();
  });
  const submittedThisWeek = thisWeekSubs.length;

  const completionRate = computeCompletionRate(args.taskInstances);

  // Avg score = average of analytics.avgScore across published instances.
  const scored = args.taskInstances
    .map((ti) => ti.analytics?.avgScore)
    .filter((v): v is number | string => v != null && v !== "")
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  const avgScore =
    scored.length > 0
      ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
      : null;

  // delta = avg score from this-week-graded submissions - last-week's.
  const avgScoreDelta = computeWeeklyScoreDelta(
    args.recentSubmissions,
    weekStart,
    lastWeekStart,
  );

  // Weak instances = instances with analytics but avgScore < 60 (indicative, frontend-only)
  const weakInstanceCount = args.taskInstances.filter((ti) => {
    const v = ti.analytics?.avgScore;
    if (v == null) return false;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n < 60;
  }).length;

  return {
    classCount: classIds.size,
    studentCount,
    submittedThisWeek,
    completionRate,
    pendingCount: args.statsPendingCount,
    avgScore,
    avgScoreDelta,
    weakInstanceCount,
  };
}

function computeCompletionRate(
  taskInstances: RawTaskInstance[],
): number | null {
  let total = 0;
  let submitted = 0;
  for (const ti of taskInstances) {
    if (ti.status !== "published") continue;
    const classSize = Number(ti.class?._count?.students ?? 0);
    const subs = Number(ti._count?.submissions ?? 0);
    if (classSize > 0) {
      total += classSize;
      submitted += Math.min(subs, classSize);
    }
  }
  if (total === 0) return null;
  return Math.round((submitted / total) * 100);
}

function computeWeeklyScoreDelta(
  subs: RawSubmission[],
  weekStart: Date,
  lastWeekStart: Date,
): number | null {
  const thisWeek: number[] = [];
  const lastWeek: number[] = [];
  for (const s of subs) {
    if (s.score == null || s.maxScore == null) continue;
    const max = Number(s.maxScore);
    if (!(max > 0)) continue;
    const norm = (Number(s.score) / max) * 100;
    if (!Number.isFinite(norm)) continue;
    const ts = s.gradedAt
      ? new Date(s.gradedAt).getTime()
      : s.submittedAt
        ? new Date(s.submittedAt).getTime()
        : 0;
    if (ts >= weekStart.getTime()) thisWeek.push(norm);
    else if (ts >= lastWeekStart.getTime()) lastWeek.push(norm);
  }
  if (thisWeek.length === 0 || lastWeek.length === 0) return null;
  const thisAvg = thisWeek.reduce((a, b) => a + b, 0) / thisWeek.length;
  const lastAvg = lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length;
  return Math.round((thisAvg - lastAvg) * 10) / 10;
}

// ============================================
// Attention list (优先待办 / 需要你关注)
// ============================================

export interface AttentionItem {
  id: string;
  taskType: TeacherTaskType;
  title: string;
  courseId: string | null;
  courseTitle: string;
  className: string | null;
  dueAt: string | null;
  submissionCount: number;
  classSize: number;
  isOverdue: boolean;
  urgent: boolean;
  hrefInstance: string;
}

export function buildAttentionItems(
  taskInstances: RawTaskInstance[],
  now: Date = new Date(),
): AttentionItem[] {
  const published = taskInstances.filter((ti) => ti.status === "published");

  const scored = published.map((ti) => ({
    ti,
    urgency: urgencyScore(ti, now),
  }));
  scored.sort((a, b) => b.urgency - a.urgency);

  return scored.slice(0, 4).map(({ ti }) => {
    const dueAt = ti.dueAt ? new Date(ti.dueAt) : null;
    const isOverdue = dueAt ? dueAt.getTime() < now.getTime() : false;
    const hoursLeft = dueAt
      ? (dueAt.getTime() - now.getTime()) / 3_600_000
      : Infinity;
    const urgent = isOverdue || (hoursLeft >= 0 && hoursLeft <= 24);
    return {
      id: String(ti.id),
      taskType: (ti.task?.taskType ??
        ti.taskType ??
        "subjective") as TeacherTaskType,
      title: ti.title ?? ti.task?.taskName ?? "未命名任务",
      courseId: ti.course?.id ?? null,
      courseTitle: ti.course?.courseTitle ?? "",
      className: ti.class?.name ?? null,
      dueAt: ti.dueAt ?? null,
      submissionCount: Number(ti._count?.submissions ?? 0),
      classSize: Number(ti.class?._count?.students ?? 0),
      isOverdue,
      urgent,
      hrefInstance: `/teacher/instances/${ti.id}`,
    };
  });
}

function urgencyScore(ti: RawTaskInstance, now: Date): number {
  // Higher = more urgent. Factors:
  // - overdue +100
  // - <24h left +60
  // - < 7d left: (7 - days) * 8
  // - submission ratio (close to finished = less urgent; zero submissions + overdue = high)
  const due = ti.dueAt ? new Date(ti.dueAt) : null;
  let score = 0;
  if (due) {
    const hoursLeft = (due.getTime() - now.getTime()) / 3_600_000;
    if (hoursLeft < 0) score += 100;
    else if (hoursLeft <= 24) score += 60;
    else if (hoursLeft <= 24 * 7) score += (7 - hoursLeft / 24) * 8;
  }
  const classSize = Number(ti.class?._count?.students ?? 0);
  const subs = Number(ti._count?.submissions ?? 0);
  if (classSize > 0) {
    const rate = Math.min(subs / classSize, 1);
    score += (1 - rate) * 20;
  }
  return score;
}

// ============================================
// Weak instances (降级 from 薄弱概念)
// ============================================

export interface WeakInstance {
  id: string;
  title: string;
  courseId: string | null;
  courseTitle: string;
  errorRate: number; // 0-100
  wrongStudentCount: number;
  href: string;
}

export function buildWeakInstances(
  taskInstances: RawTaskInstance[],
  limit: number = 3,
): WeakInstance[] {
  const candidates = taskInstances
    .filter((ti) => {
      const v = ti.analytics?.avgScore;
      const count = Number(ti.analytics?.submissionCount ?? 0);
      if (v == null || count === 0) return false;
      const n = Number(v);
      return Number.isFinite(n) && n > 0;
    })
    .map((ti) => {
      const avg = Number(ti.analytics?.avgScore);
      const count = Number(ti.analytics?.submissionCount ?? 0);
      const errorRate = Math.max(0, Math.min(100, Math.round(100 - avg)));
      // wrong student estimate = count * errorRate / 100
      const wrongStudentCount = Math.max(0, Math.round((count * errorRate) / 100));
      return {
        id: String(ti.id),
        title: ti.title ?? ti.task?.taskName ?? "未命名任务",
        courseId: ti.course?.id ?? null,
        courseTitle: ti.course?.courseTitle ?? "",
        errorRate,
        wrongStudentCount,
        href: `/teacher/instances/${ti.id}/insights`,
      };
    });

  candidates.sort((a, b) => b.errorRate - a.errorRate);
  return candidates.slice(0, limit);
}

// ============================================
// Today's schedule
// ============================================

export interface TeacherTodaySlot {
  id: string;
  courseId: string;
  courseTitle: string;
  className: string | null;
  timeLabel: string;
  classroom: string | null;
  inProgress: boolean;
}

export function buildTodaySchedule(
  scheduleSlots: RawScheduleSlot[],
  isActiveForWeek: (slot: RawScheduleSlot) => boolean,
  now: Date = new Date(),
): TeacherTodaySlot[] {
  const jsDay = now.getDay();
  const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return scheduleSlots
    .filter((s) => s.dayOfWeek === todayDayOfWeek)
    .filter((s) => isActiveForWeek(s))
    .map((s) => {
      const inProgress = computeInProgress(s.timeLabel, nowMin);
      return {
        id: String(s.id),
        courseId: String(s.course?.id ?? s.courseId ?? ""),
        courseTitle: s.course?.courseTitle ?? "未知课程",
        className:
          s.course?.class?.name ?? s.course?.classes?.[0]?.name ?? null,
        timeLabel: s.timeLabel ?? "",
        classroom: s.classroom ?? null,
        inProgress,
      };
    })
    .sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
}

function computeInProgress(timeLabel: unknown, nowMin: number): boolean {
  if (typeof timeLabel !== "string") return false;
  const match = timeLabel.match(/(\d{1,2}):(\d{2})[^\d]+(\d{1,2}):(\d{2})/);
  if (!match) return false;
  const [, sh, sm, eh, em] = match;
  const startMin = Number(sh) * 60 + Number(sm);
  const endMin = Number(eh) * 60 + Number(em);
  return nowMin >= startMin && nowMin < endMin;
}

// ============================================
// Upcoming schedule (B4 · 近期课表 — 未来 N 节课，含今天 + 之后)
// ============================================

export interface TeacherUpcomingSlot {
  id: string;
  courseId: string;
  courseTitle: string;
  className: string | null;
  timeLabel: string; // 完整时段（08:00-09:40）
  startTime: string; // 起始时间（08:00）— 用于卡片显示
  classroom: string | null;
  /** ISO date string (yyyy-MM-dd) of the actual class occurrence */
  date: string;
  /** Display label like "4/26"  */
  dateLabel: string;
  /** "周一" / "周日" */
  weekdayLabel: string;
  /** True when this slot is happening today (and may be in progress) */
  isToday: boolean;
  /** True when slot is currently within timeLabel window */
  inProgress: boolean;
}

const WEEKDAY_LABELS_FULL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 构建未来 N 节课的列表（含今天 + 之后日期，按时间升序）。
 *
 * 算法：
 * 1. 对每条 slot 在未来 14 天内查找下一次发生（dayOfWeek + week-active 条件 + 时间未过）。
 * 2. 候选条目按 (date asc, slot start time asc) 排序。
 * 3. 取前 count 条返回。
 *
 * 与 buildTodaySchedule 不同：本函数返回多日数据 + 包含 date/weekday 字段。
 */
export function buildUpcomingSchedule(
  scheduleSlots: RawScheduleSlot[],
  count: number = 4,
  now: Date = new Date(),
): TeacherUpcomingSlot[] {
  const candidates: TeacherUpcomingSlot[] = [];
  const HORIZON_DAYS = 14;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const slot of scheduleSlots) {
    const semesterRaw = slot.course?.semesterStartDate;
    const semesterStart = semesterRaw ? new Date(semesterRaw) : null;
    const startWeek = Number(slot.startWeek ?? 1);
    const endWeek = Number(slot.endWeek ?? 20);
    const weekType = (slot.weekType ?? "all") as "all" | "odd" | "even";
    const slotDayOfWeek = Number(slot.dayOfWeek ?? 0);
    if (slotDayOfWeek < 1 || slotDayOfWeek > 7) continue;

    const startTime = parseStartTime(slot.timeLabel);

    for (let dayOffset = 0; dayOffset < HORIZON_DAYS; dayOffset++) {
      const candidateDate = new Date(now);
      candidateDate.setHours(0, 0, 0, 0);
      candidateDate.setDate(candidateDate.getDate() + dayOffset);

      const candDayOfWeek = candidateDate.getDay() === 0 ? 7 : candidateDate.getDay();
      if (candDayOfWeek !== slotDayOfWeek) continue;

      // 计算该日期是第几教学周
      let weekNumber = 0;
      if (semesterStart) {
        const diffMs = candidateDate.getTime() - semesterStart.getTime();
        if (diffMs < 0) continue;
        weekNumber = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
      }

      // 学期内 + week 范围 + weekType 约束（无 semesterStart 的不约束 fallback 接受当天）
      if (semesterStart) {
        if (weekNumber < startWeek || weekNumber > endWeek) continue;
        if (weekType === "odd" && weekNumber % 2 !== 1) continue;
        if (weekType === "even" && weekNumber % 2 !== 0) continue;
      }

      // 今天的时段如果起始时间已过，跳过（避免显示已结束的课）
      if (dayOffset === 0 && startTime != null && startTime < nowMin) {
        const endTime = parseEndTime(slot.timeLabel);
        if (endTime == null || endTime <= nowMin) continue;
      }

      const dateIso = candidateDate.toISOString().slice(0, 10);
      const dateLabel = `${candidateDate.getMonth() + 1}/${candidateDate.getDate()}`;
      const weekdayLabel = WEEKDAY_LABELS_FULL[candidateDate.getDay()];
      const isToday = dayOffset === 0;
      const inProgress = isToday ? computeInProgress(slot.timeLabel, nowMin) : false;
      const startTimeLabel = formatTime(startTime);

      candidates.push({
        id: String(slot.id),
        courseId: String(slot.course?.id ?? slot.courseId ?? ""),
        courseTitle: slot.course?.courseTitle ?? "未知课程",
        className:
          slot.course?.class?.name ?? slot.course?.classes?.[0]?.name ?? null,
        timeLabel: slot.timeLabel ?? "",
        startTime: startTimeLabel,
        classroom: slot.classroom ?? null,
        date: dateIso,
        dateLabel,
        weekdayLabel,
        isToday,
        inProgress,
      });
      break; // each slot contributes only its next occurrence
    }
  }

  candidates.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
  return candidates.slice(0, count);
}

function parseStartTime(timeLabel: unknown): number | null {
  if (typeof timeLabel !== "string") return null;
  const match = timeLabel.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, h, m] = match;
  return Number(h) * 60 + Number(m);
}

function parseEndTime(timeLabel: unknown): number | null {
  if (typeof timeLabel !== "string") return null;
  const match = timeLabel.match(/(\d{1,2}):(\d{2})[^\d]+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, , , eh, em] = match;
  return Number(eh) * 60 + Number(em);
}

function formatTime(min: number | null): string {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================
// Activity feed
// ============================================

export interface ActivityItem {
  id: string;
  who: string;
  action: "graded" | "submitted";
  taskName: string;
  taskType: TeacherTaskType;
  time: string; // ISO
  score: number | null;
  maxScore: number | null;
}

export function buildActivityFeed(
  submissions: RawSubmission[],
  limit: number = 4,
): ActivityItem[] {
  return submissions.slice(0, limit).map((s) => ({
    id: String(s.id),
    who: s.student?.name ?? "匿名同学",
    action: (s.status === "graded" ? "graded" : "submitted") as "graded" | "submitted",
    taskName: s.task?.taskName ?? "任务",
    taskType: (s.taskType ?? "subjective") as TeacherTaskType,
    time: s.gradedAt || s.submittedAt,
    score:
      s.status === "graded" && s.score != null ? Number(s.score) : null,
    maxScore:
      s.status === "graded" && s.maxScore != null ? Number(s.maxScore) : null,
  }));
}

// ============================================
// Class performance (per-class aggregate + 8-week trend)
// ============================================

export interface ClassPerformanceRow {
  classId: string;
  className: string;
  avgScore: number;
  studentCount: number;
}

export function buildClassPerformance(
  taskInstances: RawTaskInstance[],
): ClassPerformanceRow[] {
  const acc = new Map<
    string,
    { className: string; scoreSum: number; scoreCount: number; studentMax: number }
  >();

  for (const ti of taskInstances) {
    const classId = ti.class?.id ? String(ti.class.id) : null;
    const className = ti.class?.name ?? "";
    if (!classId) continue;
    const avg = ti.analytics?.avgScore;
    const studentCount = Number(ti.class?._count?.students ?? 0);
    const bucket = acc.get(classId) ?? {
      className,
      scoreSum: 0,
      scoreCount: 0,
      studentMax: 0,
    };
    if (avg != null) {
      const n = Number(avg);
      if (Number.isFinite(n) && n > 0) {
        bucket.scoreSum += n;
        bucket.scoreCount += 1;
      }
    }
    if (studentCount > bucket.studentMax) bucket.studentMax = studentCount;
    bucket.className = bucket.className || className;
    acc.set(classId, bucket);
  }

  const rows: ClassPerformanceRow[] = [];
  for (const [classId, b] of acc) {
    if (b.scoreCount === 0) continue;
    rows.push({
      classId,
      className: b.className || "未命名班级",
      avgScore: Math.round((b.scoreSum / b.scoreCount) * 10) / 10,
      studentCount: b.studentMax,
    });
  }
  rows.sort((a, b) => b.avgScore - a.avgScore);
  return rows;
}

export interface WeeklyTrendPoint {
  weekLabel: string; // "W1" ... "W8"
  weekStart: string; // ISO date
  avgScore: number | null;
  submissionCount: number;
}

export function buildWeeklyTrend(
  submissions: RawSubmission[],
  now: Date = new Date(),
  windowWeeks: number = 8,
): WeeklyTrendPoint[] {
  const currentWeekStart = startOfWeek(now);
  const buckets: { start: Date; scores: number[]; count: number }[] = [];
  for (let i = windowWeeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ start, scores: [], count: 0 });
  }

  for (const s of submissions) {
    const ts = s.submittedAt ? new Date(s.submittedAt).getTime() : 0;
    if (!ts) continue;
    for (let i = 0; i < buckets.length; i++) {
      const start = buckets[i].start.getTime();
      const end = start + 7 * 24 * 3_600_000;
      if (ts >= start && ts < end) {
        buckets[i].count += 1;
        if (s.status === "graded" && s.score != null && s.maxScore != null) {
          const max = Number(s.maxScore);
          if (max > 0) {
            const norm = (Number(s.score) / max) * 100;
            if (Number.isFinite(norm)) buckets[i].scores.push(norm);
          }
        }
        break;
      }
    }
  }

  return buckets.map((b, i) => ({
    weekLabel: `W${i + 1}`,
    weekStart: b.start.toISOString(),
    avgScore:
      b.scores.length > 0
        ? Math.round((b.scores.reduce((a, v) => a + v, 0) / b.scores.length) * 10) / 10
        : null,
    submissionCount: b.count,
  }));
}

// ============================================
// Helpers
// ============================================

export function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

export function buildDateLine(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const jsDay = now.getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return `${y} 年 ${m} 月 ${d} 日 · ${labels[idx]}`;
}
