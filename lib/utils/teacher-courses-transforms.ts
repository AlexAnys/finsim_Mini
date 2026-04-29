// Pure data transforms for the teacher /courses list page.

/* eslint-disable @typescript-eslint/no-explicit-any */
type RawCourse = Record<string, any>;
type RawTaskInstance = Record<string, any>;
type RawSubmission = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TeacherInfo {
  id: string;
  name: string;
  email: string | null;
  isCreator: boolean;
}

/**
 * Build the ordered teacher list for a course: creator first, then CourseTeacher rows.
 * De-duplicates by teacher.id.
 */
export function buildTeacherList(course: RawCourse): TeacherInfo[] {
  const out: TeacherInfo[] = [];
  const seen = new Set<string>();

  const creator = course.creator;
  if (creator?.id) {
    out.push({
      id: String(creator.id),
      name: creator.name || teacherInitialFallback(creator.email),
      email: creator.email ?? null,
      isCreator: true,
    });
    seen.add(String(creator.id));
  }

  const nested = course.teachers;
  if (Array.isArray(nested)) {
    for (const ct of nested) {
      const t = ct?.teacher;
      if (!t?.id) continue;
      const id = String(t.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: t.name || teacherInitialFallback(t.email),
        email: t.email ?? null,
        isCreator: false,
      });
    }
  }

  return out;
}

function teacherInitialFallback(email: string | null | undefined): string {
  if (!email) return "老师";
  const local = email.split("@")[0] || "老师";
  return local.charAt(0).toUpperCase();
}

/**
 * First visible character of a display name.
 * "李老师" → "李", "Li Wang" → "L", "" → "师"
 */
export function displayInitial(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "师";
  // Unicode codepoint aware
  const first = Array.from(trimmed)[0];
  return first ? first.toUpperCase() : "师";
}

/**
 * Union of all classNames linked to the course (primary + CourseClass).
 */
export function buildClassNames(course: RawCourse): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Prefer the CourseClass list (multi-class); fall back to single primary class.
  const nested = course.classes;
  if (Array.isArray(nested) && nested.length > 0) {
    for (const cc of nested) {
      const n = cc?.class?.name;
      if (!n) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
  } else if (course.class?.name) {
    out.push(course.class.name);
  }
  return out;
}

export interface CourseMetrics {
  taskCount: number;
  publishedCount: number;
  studentCount: number;
  avgScore: number | null;
  pendingCount: number;
}

/**
 * Aggregate per-course metrics from the dashboard data.
 *
 * studentCount source-of-truth (in priority order):
 *   1. Sum of all linked class._count.students from course.classes (CourseClass rows)
 *   2. course.class._count.students (legacy single-class fallback)
 *   3. max(class._count.students) across this course's task instances
 *
 * Without (1) and (2), a brand-new course with classes attached but zero task
 * instances would show 0 students + "未关联班级" — which is wrong because the
 * enrollment is already known from CourseClass relations.
 */
export function buildCourseMetrics(
  course: RawCourse,
  taskInstances: RawTaskInstance[],
  submissions: RawSubmission[],
): CourseMetrics {
  const courseId = String(course.id ?? "");
  const instancesForCourse = taskInstances.filter(
    (ti) => (ti.course?.id ?? ti.courseId) === courseId,
  );
  const instanceIds = new Set(
    instancesForCourse.map((ti) => String(ti.id)),
  );

  // Prefer CourseClass relations (source-of-truth); fall back to legacy single
  // primary class; finally fall back to the largest class observed on instances.
  let studentCount = 0;
  const ccList = Array.isArray(course.classes) ? course.classes : [];
  if (ccList.length > 0) {
    for (const cc of ccList) {
      const n = Number(cc?.class?._count?.students ?? 0);
      if (Number.isFinite(n)) studentCount += n;
    }
  } else if (course.class?._count?.students != null) {
    const n = Number(course.class._count.students);
    if (Number.isFinite(n)) studentCount = n;
  }
  if (studentCount === 0) {
    for (const ti of instancesForCourse) {
      const n = Number(ti.class?._count?.students ?? 0);
      if (Number.isFinite(n) && n > studentCount) studentCount = n;
    }
  }

  const scored = instancesForCourse
    .map((ti) => ti.analytics?.avgScore)
    .filter((v): v is number | string => v != null && v !== "")
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  const avgScore =
    scored.length > 0
      ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
      : null;

  let pendingCount = 0;
  for (const s of submissions) {
    if (
      s.taskInstanceId &&
      instanceIds.has(String(s.taskInstanceId)) &&
      (s.status === "submitted" || s.status === "grading")
    ) {
      pendingCount += 1;
    }
  }

  const publishedCount = instancesForCourse.filter(
    (ti) => ti.status === "published",
  ).length;

  return {
    taskCount: instancesForCourse.length,
    publishedCount,
    studentCount,
    avgScore,
    pendingCount,
  };
}

export interface TeacherCourseSummary {
  totalCourses: number;
  totalStudents: number;
  totalActiveTasks: number;
  totalPending: number;
}

/**
 * Top summary strip. 学生总数 is sum of unique classSizes (per ClassId seen
 * across instances); activeTasks = published instances with dueAt in the past 7d
 * or future; pending from stats.pendingCount.
 */
export function buildTeacherCourseSummary(args: {
  courses: RawCourse[];
  taskInstances: RawTaskInstance[];
  pendingCount: number;
  now?: Date;
}): TeacherCourseSummary {
  const now = args.now ?? new Date();
  const sevenDaysAgoMs = now.getTime() - 7 * 24 * 3_600_000;

  const classSizeByClassId = new Map<string, number>();
  for (const ti of args.taskInstances) {
    const cid = ti.class?.id;
    if (!cid) continue;
    const n = Number(ti.class?._count?.students ?? 0);
    const prev = classSizeByClassId.get(String(cid)) ?? 0;
    if (n > prev) classSizeByClassId.set(String(cid), n);
  }
  let totalStudents = 0;
  for (const size of classSizeByClassId.values()) totalStudents += size;

  let totalActiveTasks = 0;
  for (const ti of args.taskInstances) {
    if (ti.status !== "published") continue;
    const due = ti.dueAt ? new Date(ti.dueAt).getTime() : 0;
    if (!due) continue;
    // Active = either upcoming OR within past 7 days
    if (due >= sevenDaysAgoMs) totalActiveTasks += 1;
  }

  return {
    totalCourses: args.courses.length,
    totalStudents,
    totalActiveTasks,
    totalPending: args.pendingCount,
  };
}
