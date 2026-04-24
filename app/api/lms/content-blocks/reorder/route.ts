import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertContentBlockWritable } from "@/lib/auth/resource-access";
import { reorderContentBlocks } from "@/lib/services/course.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        order: z.number().int().min(0),
      })
    )
    .min(1)
    .max(200),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    // Assert write access for every block in the payload; any FORBIDDEN aborts the whole op.
    for (const it of parsed.data.items) {
      await assertContentBlockWritable(it.id, user);
    }

    const updated = await reorderContentBlocks(parsed.data.items);
    return success(updated);
  } catch (err) {
    return handleServiceError(err);
  }
}
