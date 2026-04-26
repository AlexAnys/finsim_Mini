import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { batchReleaseSubmissions } from "@/lib/services/release.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const batchReleaseSchema = z.object({
  submissionIds: z.array(z.string().uuid()).min(1).max(500),
  released: z.boolean(),
});

/**
 * PR-SIM-1a D1: 教师批量公布 / 撤回 submissions
 *
 * - submissionIds: 1..500 条 UUID
 * - released: true=公布 / false=撤回
 *
 * 返回 { released: <实际生效的条数>, skipped: <非 graded 跳过的条数> }
 */
export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = batchReleaseSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    const out = await batchReleaseSubmissions(
      parsed.data.submissionIds,
      { id: user.id, role: user.role, classId: user.classId },
      parsed.data.released,
    );
    return success(out);
  } catch (err) {
    return handleServiceError(err);
  }
}
