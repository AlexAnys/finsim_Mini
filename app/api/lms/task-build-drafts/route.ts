import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { created, handleServiceError, success, validationError } from "@/lib/api-utils";
import {
  createTaskBuildDraft,
  listTaskBuildDrafts,
} from "@/lib/services/task-build-draft.service";

const taskTypeSchema = z.enum(["simulation", "quiz", "subjective"]);
const slotSchema = z.enum(["pre", "in", "post"]);

const createDraftSchema = z.object({
  courseId: z.string().uuid(),
  chapterId: z.string().uuid().nullable().optional(),
  sectionId: z.string().uuid().nullable().optional(),
  slot: slotSchema.nullable().optional(),
  taskType: taskTypeSchema,
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(["draft", "queued", "processing", "ready", "failed"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  sourceIds: z.array(z.string().uuid()).max(50).optional(),
  asyncJobId: z.string().uuid().nullable().optional(),
  missingFields: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  draftPayload: z.unknown().optional(),
  error: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) return validationError("缺少 courseId");

    const { user } = result.session;
    await assertCourseAccess(courseId, user.id, user.role);
    const drafts = await listTaskBuildDrafts(courseId);
    return success(drafts);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createDraftSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    const data = parsed.data;
    await assertCourseAccess(data.courseId, user.id, user.role);
    const draft = await createTaskBuildDraft(user.id, {
      courseId: data.courseId,
      chapterId: data.chapterId ?? null,
      sectionId: data.sectionId ?? null,
      slot: data.slot ?? null,
      taskType: data.taskType,
      title: data.title,
      description: data.description,
      status: data.status,
      progress: data.progress,
      sourceIds: data.sourceIds,
      asyncJobId: data.asyncJobId ?? null,
      missingFields: data.missingFields,
      draftPayload: data.draftPayload as import("@prisma/client").Prisma.InputJsonValue | undefined,
      error: data.error,
    });
    return created(draft);
  } catch (err) {
    return handleServiceError(err);
  }
}
