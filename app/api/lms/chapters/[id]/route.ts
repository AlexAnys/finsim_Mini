import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertChapterWritable } from "@/lib/auth/resource-access";
import { updateChapter, deleteChapter } from "@/lib/services/course.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    order: z.number().int().min(0).optional(),
  })
  .refine((v) => v.title !== undefined || v.order !== undefined, {
    message: "请至少提供一个可更新字段",
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    await assertChapterWritable(id, user);

    const chapter = await updateChapter(id, parsed.data);
    return success(chapter);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertChapterWritable(id, user);

    await deleteChapter(id);
    return success({ id });
  } catch (err) {
    return handleServiceError(err);
  }
}
