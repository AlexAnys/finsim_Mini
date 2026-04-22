import { prisma } from "@/lib/db/prisma";
import { teacherCourseFilter } from "@/lib/services/course.service";

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
          { createdBy: teacherId },
          { course: teacherCourseFilter(teacherId) },
        ],
      },
      include: {
        task: { select: { id: true, taskName: true, taskType: true } },
        class: { select: { id: true, name: true, _count: { select: { students: true } } } },
        course: { select: { id: true, courseTitle: true } },
        chapter: { select: { id: true, title: true } },
        section: { select: { id: true, title: true } },
        analytics: { select: { avgScore: true, submissionCount: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // 最近提交
    prisma.submission.findMany({
      where: {
        OR: [
          { task: { creatorId: teacherId } },
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
      include: { course: { select: { courseTitle: true, classId: true, semesterStartDate: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { slotIndex: "asc" }],
    }),
  ]);

  // 聚合统计（并行执行）
  const submissionFilter = {
    OR: [
      { task: { creatorId: teacherId } },
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

  return {
    courses,
    taskInstances,
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
// 学生仪表盘
// ============================================
export async function getStudentDashboard(studentId: string, classId: string) {
  const [courses, taskInstances, mySubmissions, announcements, scheduleSlots] = await Promise.all([
    // 本班课程（包含通过 CourseClass 关联的课程）
    prisma.course.findMany({
      where: {
        OR: [{ classId }, { classes: { some: { classId } } }],
      },
      include: {
        class: { select: { id: true, name: true } },
        classes: { include: { class: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // 已发布的任务实例（按 TaskInstance.classId 精确匹配本班，避免跨班泄露）
    prisma.taskInstance.findMany({
      where: { classId, status: "published" },
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
      },
      orderBy: { submittedAt: "desc" },
    }),
    // 公告（包含通过 CourseClass 关联的课程公告）
    prisma.announcement.findMany({
      where: {
        course: {
          OR: [{ classId }, { classes: { some: { classId } } }],
        },
        status: "published",
      },
      include: {
        course: { select: { courseTitle: true } },
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // 课表（包含通过 CourseClass 关联的课程课表）
    prisma.scheduleSlot.findMany({
      where: { course: { OR: [{ classId }, { classes: { some: { classId } } }] } },
      include: {
        course: { select: { courseTitle: true, classId: true, semesterStartDate: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { slotIndex: "asc" }],
    }),
  ]);

  // 为每个任务实例计算学生状态
  const taskWithStatus = taskInstances.map((ti) => {
    const subs = mySubmissions.filter((s) => s.taskInstanceId === ti.id);
    const latestSub = subs[0];
    const now = new Date();
    const isOverdue = now > ti.dueAt;

    let studentStatus: "todo" | "submitted" | "graded" | "overdue" = "todo";
    if (latestSub) {
      if (latestSub.status === "graded") studentStatus = "graded";
      else studentStatus = "submitted";
    } else if (isOverdue) {
      studentStatus = "overdue";
    }

    const attemptsUsed = subs.length;
    const canSubmit =
      !isOverdue &&
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
