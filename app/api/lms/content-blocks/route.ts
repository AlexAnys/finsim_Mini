import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { createContentBlock } from "@/lib/services/course.service";
import { created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createSchema = z.object({
  courseId: z.string().uuid(),
  chapterId: z.string().uuid(),
  sectionId: z.string().uuid(),
  slot: z.enum(["pre", "in", "post"]),
  blockType: z.enum([
    "markdown",
    "resource",
    "simulation_config",
    "quiz",
    "subjective",
    "custom",
  ]),
  payload: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    // Course-level access is the single source of truth for all chapter/section/block ops
    // within that course. The service then cross-validates section parentage.
    await assertCourseAccess(parsed.data.courseId, user.id, user.role);

    const block = await createContentBlock({
      courseId: parsed.data.courseId,
      chapterId: parsed.data.chapterId,
      sectionId: parsed.data.sectionId,
      slot: parsed.data.slot,
      blockType: parsed.data.blockType,
      payload: parsed.data.payload as import("@prisma/client").Prisma.InputJsonValue | undefined,
    });
    return created(block);
  } catch (err) {
    return handleServiceError(err);
  }
}
