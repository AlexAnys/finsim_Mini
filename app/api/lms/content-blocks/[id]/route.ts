import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertContentBlockWritable } from "@/lib/auth/resource-access";
import { updateContentBlock, deleteContentBlock } from "@/lib/services/course.service";
import { logAuditForced } from "@/lib/services/audit.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const patchSchema = z
  .object({
    payload: z.unknown().optional(),
    order: z.number().int().min(0).optional(),
  })
  .refine((v) => v.payload !== undefined || v.order !== undefined, {
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
    await assertContentBlockWritable(id, user);

    const block = await updateContentBlock(id, {
      payload: parsed.data.payload as
        | import("@prisma/client").Prisma.InputJsonValue
        | undefined,
      order: parsed.data.order,
    });
    // PR-FIX-1 UX5: 安全敏感写入强制 audit
    await logAuditForced({
      action: "contentBlock.update",
      actorId: user.id,
      targetId: id,
      targetType: "contentBlock",
      metadata: {
        fields: Object.keys(parsed.data).filter(
          (k) => parsed.data[k as keyof typeof parsed.data] !== undefined,
        ),
      },
    });
    return success(block);
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
    await assertContentBlockWritable(id, user);

    await deleteContentBlock(id);
    // PR-FIX-1 UX5: 安全敏感删除强制 audit
    await logAuditForced({
      action: "contentBlock.delete",
      actorId: user.id,
      targetId: id,
      targetType: "contentBlock",
    });
    return success({ id });
  } catch (err) {
    return handleServiceError(err);
  }
}
