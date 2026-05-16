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
 *
 * Codex-P1-r4: 删除 task-level fallback over-match
 *   `{ task: { taskInstances: { some: { courseId } } } }` 会在 task 复用多课程时
 *   把别课程的 post 拉进来（task 同时有 courseA + courseB 实例 → 老师只有 courseA
 *   权限也能看到 courseB 的 post，含学生身份）。
 *   Unit 6 之后 createPost 强制反推 resolvedCourseId 持久化（service r2+r3 已修），
 *   所有新 post 必有 courseId；老 task-bound post 都有 taskInstanceId
 *   (task-bound 必经 instance 上下文)，第 1 条 taskInstance.courseId filter 覆盖。
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

    // Unit B2: 可选 courseId 过滤（用于课程详情 SB 统计 tab）。
    // 安全约束：客户端传的 courseId 必须先与 owner+collab 课程列表交集；
    // 未授权的 courseId 静默返空，避免 enum scanning。
    const filterCourseId = searchParams.get("courseId");
    if (filterCourseId && !courseIds.includes(filterCourseId)) {
      return success({ posts: [], stats: { total: 0, pending: 0, answered: 0, students: 0 } });
    }
    const effectiveCourseIds = filterCourseId ? [filterCourseId] : courseIds;

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
          // task-bound：通过 taskInstance.courseId
          { taskInstance: { courseId: { in: effectiveCourseIds } } },
          // free-form 或 Unit 6 后 task-bound 反推：直接通过 post.courseId
          { courseId: { in: effectiveCourseIds } },
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
