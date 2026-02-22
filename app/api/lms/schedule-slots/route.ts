import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createScheduleSlot, getScheduleSlots } from "@/lib/services/schedule.service";
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

    const slot = await createScheduleSlot({
      ...parsed.data,
      createdBy: result.session.user.id,
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
    const filters: { courseId?: string; classId?: string } = { courseId };
    if (result.session.user.role === "student" && result.session.user.classId) {
      filters.classId = result.session.user.classId;
    }

    const slots = await getScheduleSlots(filters);
    return success(slots);
  } catch (err) {
    return handleServiceError(err);
  }
}
