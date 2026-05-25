import { prisma } from "@/lib/db/prisma";
import { courseClassFilter, teacherCourseFilter } from "@/lib/services/course.service";
import { normalizeScore } from "@/lib/services/analytics-v2.service";

// ============================================
// 教师仪表盘
// ============================================
export async function getTeacherDashboard(teacherId: string) {
  const [courses, taskInstances, recentSubmissions, announcements, scheduleSlots] = await Promise.all([
    // 课程列表
    prisma.course.findMany({
      where: teacherCourseFilter(teacherId),
      include: { class: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // 任务实例统计（含 standalone 实例，即 courseId=null 的实例）
    prisma.taskInstance.findMany({
      where: {
        OR: [
          // standalone（courseId=null）或非归档课程的、本人创建的实例（归档课程的实例消失）
          { createdBy: teacherId, OR: [{ courseId: null }, { course: { deletedAt: null } }] },
          { course: teacherCourseFilter(teacherId) },
        ],
      },
      include: {
        task: { select: { id: true, taskName: true, taskType: true } },
        class: { select: { id: true, name: true, _count: { select: { students: true } } } },
        course: { select: { id: true, courseTitle: true } },
        chapter: { select: { id: true, title: true } },
        section: { select: { id: true, title: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // 最近提交
    prisma.submission.findMany({
      where: {
        OR: [
          // 本人任务的提交，但排除其实例属于已归档课程（保留无实例/standalone 提交）
          {
            task: { creatorId: teacherId },
            OR: [
              { taskInstanceId: null },
              { taskInstance: { OR: [{ courseId: null }, { course: { deletedAt: null } }] } },
            ],
          },
          { taskInstance: { course: teacherCourseFilter(teacherId) } },
        ],
      },
      include: {
        student: { select: { id: true, name: true } },
        task: { select: { id: true, taskName: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
    // 最近公告
    prisma.announcement.findMany({
      where: { course: teacherCourseFilter(teacherId) },
      include: { course: { select: { courseTitle: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // 课表时段
    prisma.scheduleSlot.findMany({
      where: { course: teacherCourseFilter(teacherId) },
      include: {
        course: {
          select: {
            id: true,
            courseTitle: true,
            semesterStartDate: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { slotIndex: "asc" }],
    }),
  ]);

  // 聚合统计（并行执行）
  const submissionFilter = {
    OR: [
      {
        task: { creatorId: teacherId },
        OR: [
          { taskInstanceId: null },
          { taskInstance: { OR: [{ courseId: null }, { course: { deletedAt: null } }] } },
        ],
      },
      { taskInstance: { course: teacherCourseFilter(teacherId) } },
    ],
  };
  const [submittedCount, gradedCount, pendingCount] = await Promise.all([
    prisma.submission.count({
      where: { ...submissionFilter, status: "submitted" },
    }),
    prisma.submission.count({
      where: { ...submissionFilter, status: "graded" },
    }),
    prisma.submission.count({
      where: { ...submissionFilter, status: { in: ["submitted", "grading"] } },
    }),
  ]);

  // 统计过期未提交
  const publishedInstances = taskInstances.filter((ti) => ti.status === "published");
  const draftCount = taskInstances.filter((ti) => ti.status === "draft").length;
  const publishedCount = publishedInstances.length;

  // 实时聚合 analytics（avgScore + submissionCount）。扫这批 instance 的 graded
  // submissions，按 instanceId 分组算归一化均分（0-100）。
  const liveAnalytics = await computeLiveAnalytics(
    taskInstances.map((ti) => ti.id),
  );
  const taskInstancesWithAnalytics = taskInstances.map((ti) => ({
    ...ti,
    analytics: liveAnalytics.get(ti.id) ?? null,
  }));

  return {
    courses,
    taskInstances: taskInstancesWithAnalytics,
    recentSubmissions,
    announcements,
    scheduleSlots,
    stats: {
      submittedCount,
      gradedCount,
      pendingCount,
      draftCount,
      publishedCount,
    },
  };
}

// ============================================
// Live analytics 聚合
// ============================================
export interface LiveInstanceAnalytics {
  avgScore: number | null;
  submissionCount: number;
}

/**
 * 按 taskInstanceId 分组，计算 graded submission 的归一化均分（0-100）+ 已批改数。
 * 与 insights.service.ts / analytics-v2.service.ts 的 normalizeScore 同口径：
 *   (score / maxScore) * 100，逐条算后取平均。
 */
async function computeLiveAnalytics(
  instanceIds: string[],
): Promise<Map<string, LiveInstanceAnalytics>> {
  const result = new Map<string, LiveInstanceAnalytics>();
  if (instanceIds.length === 0) return result;

  const graded = await prisma.submission.findMany({
    where: {
      taskInstanceId: { in: instanceIds },
      status: "graded",
      score: { not: null },
      maxScore: { not: null },
    },
    select: { taskInstanceId: true, score: true, maxScore: true },
  });

  const bucket = new Map<string, number[]>();
  for (const s of graded) {
    if (!s.taskInstanceId) continue;
    const pct = normalizeScore(s.score, s.maxScore);
    if (pct === null) continue;
    const arr = bucket.get(s.taskInstanceId) ?? [];
    arr.push(pct);
    bucket.set(s.taskInstanceId, arr);
  }
  for (const [id, scores] of bucket) {
    const sum = scores.reduce((a, b) => a + b, 0);
    result.set(id, {
      avgScore: Math.round((sum / scores.length) * 100) / 100,
      submissionCount: scores.length,
    });
  }
  return result;
}

// ============================================
// 学生仪表盘
// ============================================
export async function getStudentDashboard(studentId: string, classId: string) {
  const [courses, taskInstances, mySubmissions, announcements, scheduleSlots] = await Promise.all([
    // 本班课程（通过 CourseClass 关联）
    prisma.course.findMany({
      where: courseClassFilter(classId),
      include: {
        classes: { include: { class: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Unit 3: 包含已发布 + 已关闭的本班任务实例。closed 状态稍后过滤为"我有 submission"
    prisma.taskInstance.findMany({
      where: {
        classId,
        status: { in: ["published", "closed"] },
        // 已归档课程的任务对学生消失（保留 standalone courseId=null）
        OR: [{ courseId: null }, { course: { deletedAt: null } }],
      },
      include: {
        task: { select: { id: true, taskName: true, taskType: true } },
        course: { select: { id: true, courseTitle: true } },
        chapter: { select: { id: true, title: true } },
        section: { select: { id: true, title: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    // 我的提交
    prisma.submission.findMany({
      where: { studentId },
      select: {
        id: true,
        taskId: true,
        taskInstanceId: true,
        status: true,
        score: true,
        maxScore: true,
        submittedAt: true,
        gradedAt: true,
        releasedAt: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    // 公告（通过 CourseClass 关联的课程公告）
    prisma.announcement.findMany({
      where: {
        course: courseClassFilter(classId),
        status: "published",
      },
      include: {
        course: { select: { courseTitle: true } },
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // 课表（通过 CourseClass 关联的课程课表）
    prisma.scheduleSlot.findMany({
      where: { course: courseClassFilter(classId) },
      include: {
        course: { select: { courseTitle: true, semesterStartDate: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { slotIndex: "asc" }],
    }),
  ]);

  // Unit 3: closed 任务实例仅当本人有 submission 时保留（隐私 + 体验，避免列表混入未参与的已结束任务）
  const mySubInstanceIds = new Set(
    mySubmissions
      .map((s) => s.taskInstanceId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const visibleTaskInstances = taskInstances.filter((ti) =>
    ti.status === "published" || (ti.status === "closed" && mySubInstanceIds.has(ti.id)),
  );

  // 为每个任务实例计算学生状态
  const taskWithStatus = visibleTaskInstances.map((ti) => {
    const subs = mySubmissions.filter((s) => s.taskInstanceId === ti.id);
    const latestSub = subs[0];
    const now = new Date();
    const isOverdue = now > ti.dueAt;

    let studentStatus: "todo" | "submitted" | "grading" | "graded" | "failed" | "overdue" = "todo";
    if (latestSub) {
      if (latestSub.status === "graded") studentStatus = "graded";
      else if (latestSub.status === "grading") studentStatus = "grading";
      else if (latestSub.status === "failed") studentStatus = "failed";
      else studentStatus = "submitted";
    } else if (isOverdue) {
      studentStatus = "overdue";
    }

    const attemptsUsed = subs.length;
    const canSubmit =
      ti.status === "published" &&
      (!ti.attemptsAllowed || attemptsUsed < ti.attemptsAllowed);

    return {
      ...ti,
      studentStatus,
      canSubmit,
      attemptsUsed,
      attemptsAllowed: ti.attemptsAllowed,
      latestScore: latestSub?.status === "graded" ? latestSub.score : null,
      latestMaxScore: latestSub?.status === "graded" ? latestSub.maxScore : null,
      latestSubmissionId: latestSub?.id ?? null,
    };
  });

  return {
    courses,
    tasks: taskWithStatus,
    recentSubmissions: mySubmissions.slice(0, 10),
    announcements,
    scheduleSlots,
  };
}
