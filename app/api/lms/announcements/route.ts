import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { assertCourseAccess, assertCourseAccessForStudent } from "@/lib/auth/course-access";
import { createAnnouncement, getAnnouncements } from "@/lib/services/announcement.service";
import { parseListTake } from "@/lib/pagination";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createAnnouncementSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).max(500),
  body: z.string().min(1),
  status: z.enum(["published", "draft"]).default("draft"),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    // PR-FIX-1 A6: 防教师向他人课程发公告
    await assertCourseAccess(parsed.data.courseId, user.id, user.role);

    const announcement = await createAnnouncement({
      ...parsed.data,
      createdBy: user.id,
    });
    return created(announcement);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId") || undefined;

  try {
    const filters: {
      courseId?: string;
      classId?: string;
      teacherId?: string;
      status?: string;
      take?: number;
    } = { courseId };
    const { user } = result.session;

    if (user.role === "student") {
      // PR-FIX-1 A6: 学生侧若传 courseId 必须验证有班级访问权
      if (courseId) {
        await assertCourseAccessForStudent(courseId, user.classId ?? "");
      }
      if (user.classId) {
        filters.classId = user.classId;
      }
      filters.status = "published";
    } else if (user.role === "teacher") {
      if (courseId) {
        // PR-FIX-1 A6: 老师传 courseId 必须 owner / collab，否则 403
        await assertCourseAccess(courseId, user.id, user.role);
      } else {
        // 老师侧：没指定 courseId 时，只看自己 creator 或 CourseTeacher 的课公告
        filters.teacherId = user.id;
      }
    }
    // admin 不加 teacherId 过滤，仍可看全部（保留管理员全局视角）
    filters.take = parseListTake(searchParams, 100, 200);

    const announcements = await getAnnouncements(filters);
    return success(announcements);
  } catch (err) {
    return handleServiceError(err);
  }
}
