import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { releaseSubmission, unreleaseSubmission } from "@/lib/services/release.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const releaseSchema = z.object({
  released: z.boolean(),
});

/**
 * PR-SIM-1a D1: 教师手动公布 / 撤回 submission
 * POST { released: true } → 设 releasedAt = NOW
 * POST { released: false } → 设 releasedAt = NULL（紧急撤回）
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = releaseSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    const userLike = { id: user.id, role: user.role, classId: user.classId };
    const updated = parsed.data.released
      ? await releaseSubmission(id, userLike)
      : await unreleaseSubmission(id, userLike);

    return success(updated);
  } catch (err) {
    return handleServiceError(err);
  }
}
