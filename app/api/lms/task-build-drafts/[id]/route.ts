import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import {
  deleteTaskBuildDraft,
  getTaskBuildDraft,
  updateTaskBuildDraft,
} from "@/lib/services/task-build-draft.service";

const taskTypeSchema = z.enum(["simulation", "quiz", "subjective"]);
const slotSchema = z.enum(["pre", "in", "post"]);

const updateDraftSchema = z.object({
  courseId: z.string().uuid().optional(),
  chapterId: z.string().uuid().nullable().optional(),
  sectionId: z.string().uuid().nullable().optional(),
  slot: slotSchema.nullable().optional(),
  taskType: taskTypeSchema.optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z
    .enum(["draft", "queued", "processing", "ready", "approved", "failed", "published"])
    .optional(),
  progress: z.number().min(0).max(100).optional(),
  sourceIds: z.array(z.string().uuid()).max(50).optional(),
  asyncJobId: z.string().uuid().nullable().optional(),
  missingFields: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  draftPayload: z.unknown().optional(),
  aiPayload: z.unknown().optional(),
  editedPayload: z.unknown().optional(),
  error: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const draft = await getTaskBuildDraft(id);
    await assertCourseAccess(draft.courseId, result.session.user.id, result.session.user.role);
    return success(draft);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const existing = await getTaskBuildDraft(id);
    await assertCourseAccess(existing.courseId, result.session.user.id, result.session.user.role);

    const body = await request.json();
    const parsed = updateDraftSchema.safeParse(body);
    if (!parsed.success) return validationError("请求参数错误", parsed.error.flatten());

    const courseId = parsed.data.courseId ?? existing.courseId;
    await assertCourseAccess(courseId, result.session.user.id, result.session.user.role);

    type JsonInput = import("@prisma/client").Prisma.InputJsonValue | undefined;
    const draft = await updateTaskBuildDraft(id, {
      ...parsed.data,
      draftPayload: parsed.data.draftPayload as JsonInput,
      aiPayload: parsed.data.aiPayload as JsonInput,
      editedPayload: parsed.data.editedPayload as JsonInput,
    });
    return success(draft);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const existing = await getTaskBuildDraft(id);
    await assertCourseAccess(existing.courseId, result.session.user.id, result.session.user.role);
    await deleteTaskBuildDraft(id);
    return success({ id });
  } catch (err) {
    return handleServiceError(err);
  }
}
