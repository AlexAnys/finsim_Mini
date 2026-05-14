import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { success, handleServiceError } from "@/lib/api-utils";
import {
  listAiRuns,
  aggregateAiUsageByFeature,
  type AiUsageFilters,
} from "@/lib/services/ai-usage.service";

/**
 * GET /api/lms/ai-usage
 *
 * Teacher 查自己的 AiRun 列表 + 按 feature 聚合卡。
 * Query：feature / provider / model / dateFrom / dateTo / take / skip
 * Admin 角色加 `?scope=all` 看全部（兼容 admin 在 teacher 页查全局）。
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireRole(["teacher", "admin"]);
    if (result.error) return result.error;
    const { user } = result.session;

    const url = new URL(request.url);
    const filters: AiUsageFilters = {
      feature: url.searchParams.get("feature") ?? undefined,
      provider: url.searchParams.get("provider") ?? undefined,
      model: url.searchParams.get("model") ?? undefined,
    };
    const from = url.searchParams.get("dateFrom");
    const to = url.searchParams.get("dateTo");
    if (from) filters.dateFrom = new Date(from);
    if (to) filters.dateTo = new Date(to);

    const take = Math.min(parseInt(url.searchParams.get("take") ?? "50", 10), 200);
    const skip = parseInt(url.searchParams.get("skip") ?? "0", 10);

    const scopeAll = url.searchParams.get("scope") === "all" && user.role === "admin";
    const scope = { ...filters, userId: scopeAll ? undefined : user.id };

    const [list, agg] = await Promise.all([
      listAiRuns(scope, { take, skip }),
      aggregateAiUsageByFeature(scope),
    ]);

    return success({
      items: list.items,
      total: list.total,
      aggregateByFeature: agg,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
