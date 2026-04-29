import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { updateGroup, deleteGroupForUser } from "@/lib/services/group.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const patchGroupSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    addStudentIds: z.array(z.string().uuid()).max(200).optional(),
    removeStudentIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.addStudentIds !== undefined ||
      value.removeStudentIds !== undefined,
    { message: "请至少提供一个可更新字段" },
  );

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchGroupSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }
    const { user } = result.session;
    const group = await updateGroup(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    }, parsed.data);
    return success(group);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await deleteGroupForUser(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
