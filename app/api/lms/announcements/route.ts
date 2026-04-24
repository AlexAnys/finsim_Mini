import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createAnnouncement, getAnnouncements } from "@/lib/services/announcement.service";
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

    const announcement = await createAnnouncement({
      ...parsed.data,
      createdBy: result.session.user.id,
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
    } = { courseId };
    const { user } = result.session;

    if (user.role === "student" && user.classId) {
      filters.classId = user.classId;
      filters.status = "published";
    } else if (user.role === "teacher" && !courseId) {
      // 老师侧：没指定 courseId 时，只看自己 creator 或 CourseTeacher 的课公告
      filters.teacherId = user.id;
    }
    // admin 不加 teacherId 过滤，仍可看全部（保留管理员全局视角）

    const announcements = await getAnnouncements(filters);
    return success(announcements);
  } catch (err) {
    return handleServiceError(err);
  }
}
