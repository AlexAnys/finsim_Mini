import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { success, handleServiceError } from "@/lib/api-utils";
import { listAuditLogs } from "@/lib/services/audit.service";
import { listAiRuns } from "@/lib/services/ai-usage.service";

/**
 * GET /api/admin/audit?tab=audit|ai
 *
 * Admin only. tab=audit (default) 返回 AuditLog 列表；tab=ai 返回 AiRun 全教师视角。
 * Query：action / actorId / targetType / dateFrom / dateTo / take / skip / tab
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireRole(["admin"]);
    if (result.error) return result.error;

    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") ?? "audit";

    const take = Math.min(parseInt(url.searchParams.get("take") ?? "50", 10), 200);
    const skip = parseInt(url.searchParams.get("skip") ?? "0", 10);
    const from = url.searchParams.get("dateFrom");
    const to = url.searchParams.get("dateTo");
    const dateFrom = from ? new Date(from) : undefined;
    const dateTo = to ? new Date(to) : undefined;

    if (tab === "ai") {
      const data = await listAiRuns(
        {
          feature: url.searchParams.get("feature") ?? undefined,
          provider: url.searchParams.get("provider") ?? undefined,
          model: url.searchParams.get("model") ?? undefined,
          dateFrom,
          dateTo,
        },
        { take, skip },
      );
      return success(data);
    }

    const data = await listAuditLogs(
      {
        action: url.searchParams.get("action") ?? undefined,
        actorId: url.searchParams.get("actorId") ?? undefined,
        targetType: url.searchParams.get("targetType") ?? undefined,
        dateFrom,
        dateTo,
      },
      { take, skip },
    );
    return success(data);
  } catch (err) {
    return handleServiceError(err);
  }
}
