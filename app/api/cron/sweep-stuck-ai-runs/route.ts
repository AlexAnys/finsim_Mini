import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { success, error, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";

/**
 * Cron · 把 running 超过 5 分钟的 AiRun 标记为 failed。
 *
 *   GET/POST /api/cron/sweep-stuck-ai-runs
 *   header: x-cron-token: $CRON_TOKEN  (or admin user)
 */
const STUCK_THRESHOLD_MS = 5 * 60_000;
const ERR_MESSAGE = "STUCK_TIMEOUT_GAVE_UP";

async function handle(request: NextRequest) {
  const cronToken = process.env.CRON_TOKEN;
  const headerToken = request.headers.get("x-cron-token");
  const hasCronAccess = Boolean(cronToken && headerToken === cronToken);

  if (!hasCronAccess) {
    const session = await getSession();
    if (!session?.user || session.user.role !== "admin") {
      return error("UNAUTHORIZED", "需要 cron token 或 admin 角色", 401);
    }
  }

  try {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const stuck = await prisma.aiRun.findMany({
      where: { status: "running", createdAt: { lt: cutoff } },
      select: { id: true },
      take: 200,
    });

    if (stuck.length === 0) {
      return success({ swept: 0 });
    }

    const ids = stuck.map((s) => s.id);
    const result = await prisma.aiRun.updateMany({
      where: { id: { in: ids }, status: "running" },
      data: { status: "failed", error: ERR_MESSAGE },
    });

    return success({ swept: result.count, ids });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
