import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { success, error, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { generateWeeklyInsight } from "@/lib/services/weekly-insight.service";

/**
 * 每周洞察预热入口。
 *
 * 部署侧可配置系统 cron / GitHub Actions 在每周一调用：
 *   GET /api/cron/weekly-insight
 *   header: x-cron-token: $CRON_TOKEN
 *
 * 未配置 CRON_TOKEN 的开发环境允许 admin 手动调用，便于排查。
 */
async function handleCron(request: NextRequest) {
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
    const teachers = await prisma.user.findMany({
      where: { role: { in: ["teacher", "admin"] } },
      select: { id: true, email: true },
      take: 500,
    });

    const results: Array<{ teacherId: string; email: string; ok: boolean; error?: string }> = [];
    for (const teacher of teachers) {
      try {
        await generateWeeklyInsight(teacher.id, { force: true });
        results.push({ teacherId: teacher.id, email: teacher.email, ok: true });
      } catch (err) {
        results.push({
          teacherId: teacher.id,
          email: teacher.email,
          ok: false,
          error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
        });
      }
    }

    return success({
      total: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
