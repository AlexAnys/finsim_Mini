import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { assertCourseAccess, assertCourseAccessForStudent } from "@/lib/auth/course-access";
import { createScheduleSlot, getScheduleSlots } from "@/lib/services/schedule.service";
import { parseListTake } from "@/lib/pagination";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createSlotSchema = z.object({
  courseId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  slotIndex: z.number().int().min(1).max(4),
  startWeek: z.number().int().min(1),
  endWeek: z.number().int().min(1),
  timeLabel: z.string().min(1).max(50),
  classroom: z.string().max(100).optional(),
  weekType: z.enum(["all", "odd", "even"]).default("all"),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createSlotSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    // PR-FIX-1 A7: 防教师向他人课程写课表
    await assertCourseAccess(parsed.data.courseId, user.id, user.role);

    const slot = await createScheduleSlot({
      ...parsed.data,
      createdBy: user.id,
    });
    return created(slot);
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
    const filters: { courseId?: string; classId?: string; teacherId?: string; take?: number } = { courseId };
    const { user } = result.session;
    if (user.role === "student") {
      if (courseId) {
        // PR-FIX-1 A7: 学生侧若传 courseId 必须验证班级访问权
        await assertCourseAccessForStudent(courseId, user.classId ?? "");
      }
      if (user.classId) {
        filters.classId = user.classId;
      }
    } else if (user.role === "teacher") {
      if (courseId) {
        // PR-FIX-1 A7: 老师传 courseId 必须 owner / collab，否则 403
        await assertCourseAccess(courseId, user.id, user.role);
      } else {
        filters.teacherId = user.id;
      }
    } else if (user.role === "admin" && !courseId) {
      filters.teacherId = user.id;
    }
    filters.take = parseListTake(searchParams, 200, 200);

    const slots = await getScheduleSlots(filters);
    return success(slots);
  } catch (err) {
    return handleServiceError(err);
  }
}
