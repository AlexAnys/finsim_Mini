import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { setInstanceReleaseMode } from "@/lib/services/release.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const releaseConfigSchema = z.object({
  releaseMode: z.enum(["auto", "manual"]),
  // 允许显式 null 表示清空 autoReleaseAt
  autoReleaseAt: z
    .union([z.string().datetime(), z.null()])
    .optional(),
});

/**
 * PR-SIM-1a D1: 教师设置 task instance 的公布模式
 *
 * - releaseMode: "auto" → cron 扫到 autoReleaseAt 时点批量公布
 *                "manual" → 教师单条/批量手动公布
 * - autoReleaseAt: ISO datetime 或 null。仅 auto 模式有意义；不传时保留原值
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = releaseConfigSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    const autoReleaseAt =
      parsed.data.autoReleaseAt === undefined
        ? undefined
        : parsed.data.autoReleaseAt === null
          ? null
          : new Date(parsed.data.autoReleaseAt);

    const updated = await setInstanceReleaseMode(
      id,
      { id: user.id, role: user.role, classId: user.classId },
      parsed.data.releaseMode,
      autoReleaseAt,
    );
    return success(updated);
  } catch (err) {
    return handleServiceError(err);
  }
}
