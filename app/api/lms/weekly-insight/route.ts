import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { generateWeeklyInsight } from "@/lib/services/weekly-insight.service";
import { success, handleServiceError } from "@/lib/api-utils";

/**
 * GET /api/lms/weekly-insight
 * - teacher / admin only（requireRole(["teacher", "admin"]))
 * - 默认走 1h cache；?force=true 跳缓存重新调用 AI 生成
 *
 * Returns WeeklyInsightResult（payload + generatedAt + windowStart/End + submissionCount + cached）。
 */
export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { user } = result.session;
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    const data = await generateWeeklyInsight(user.id, { force });
    return success(data);
  } catch (err) {
    return handleServiceError(err);
  }
}
