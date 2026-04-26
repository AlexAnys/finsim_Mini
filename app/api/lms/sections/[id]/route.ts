import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertSectionWritable } from "@/lib/auth/resource-access";
import { updateSection, deleteSection } from "@/lib/services/course.service";
import { logAuditForced } from "@/lib/services/audit.service";
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
    await assertSectionWritable(id, user);

    const section = await updateSection(id, parsed.data);
    // PR-FIX-1 UX5: 安全敏感写入强制 audit
    await logAuditForced({
      action: "section.update",
      actorId: user.id,
      targetId: id,
      targetType: "section",
      metadata: { fields: Object.keys(parsed.data) },
    });
    return success(section);
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
    await assertSectionWritable(id, user);

    await deleteSection(id);
    // PR-FIX-1 UX5: 安全敏感删除强制 audit
    await logAuditForced({
      action: "section.delete",
      actorId: user.id,
      targetId: id,
      targetType: "section",
    });
    return success({ id });
  } catch (err) {
    return handleServiceError(err);
  }
}
