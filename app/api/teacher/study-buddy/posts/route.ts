import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { teacherCourseFilter } from "@/lib/services/course.service";
import { success, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";

/**
 * Unit 6: 老师跨课程 Study Buddy 管理页数据源
 *
 * 拉所有 owner+collab 课程下的 SB post（含自由问 post.courseId IN courseIds）：
 * - 默认按 createdAt desc
 * - 支持 ?scope=all|pending|answered 过滤
 * - 默认过滤 hiddenAt: null + isPreview: false
 */
export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { user } = result.session;
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "all"; // all / pending / answered
    const take = Math.min(
      Math.max(parseInt(searchParams.get("take") || "100", 10), 1),
      200,
    );

    // 拿 owner+collab 课程列表
    const courses = await prisma.course.findMany({
      where: teacherCourseFilter(user.id),
      select: { id: true, courseTitle: true },
    });
    const courseIds = courses.map((c) => c.id);
    const courseTitleById = new Map(courses.map((c) => [c.id, c.courseTitle]));

    if (courseIds.length === 0) {
      return success({ posts: [], stats: { total: 0, pending: 0, answered: 0, students: 0 } });
    }

    const statusFilter =
      scope === "pending"
        ? { status: "pending" as const }
        : scope === "answered"
          ? { status: "answered" as const }
          : {};

    const posts = await prisma.studyBuddyPost.findMany({
      where: {
        hiddenAt: null,
        isPreview: false,
        ...statusFilter,
        OR: [
          // task-bound：通过 taskInstance.courseId 或 task.taskInstances any
          { taskInstance: { courseId: { in: courseIds } } },
          { task: { taskInstances: { some: { courseId: { in: courseIds } } } } },
          // free-form：直接通过 courseId 关联
          { courseId: { in: courseIds } },
        ],
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, taskName: true } },
        taskInstance: {
          select: {
            id: true,
            title: true,
            courseId: true,
            chapter: { select: { id: true, title: true } },
            section: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    // 推断 courseId / courseTitle（task-bound 没有 post.courseId 时从 taskInstance 反推）
    const enriched = posts.map((p) => {
      const inferredCourseId =
        p.courseId ?? p.taskInstance?.courseId ?? null;
      return {
        ...p,
        inferredCourseId,
        inferredCourseTitle: inferredCourseId
          ? courseTitleById.get(inferredCourseId) ?? null
          : null,
        isFreeForm: !p.taskId && !p.taskInstanceId,
      };
    });

    const stats = {
      total: enriched.length,
      pending: enriched.filter((p) => p.status === "pending").length,
      answered: enriched.filter((p) => p.status === "answered").length,
      students: new Set(enriched.map((p) => p.studentId)).size,
    };

    return success({ posts: enriched, stats });
  } catch (err) {
    return handleServiceError(err);
  }
}
