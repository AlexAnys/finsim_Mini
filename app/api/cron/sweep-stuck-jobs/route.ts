import { NextRequest } from "next/server";
import { sweepStuckJobs } from "@/lib/services/async-job.service";
import { getSession } from "@/lib/auth/guards";
import { success, error, handleServiceError } from "@/lib/api-utils";

/**
 * Fix 10 · 异步批改 cron sweeper
 *
 * 双触发模式（沿用 release-submissions 路由的 pattern）：
 * 1) 部署 cron（Vercel cron / 系统 cron）：x-cron-token header 匹配 env CRON_TOKEN → 直通
 * 2) admin 手动调用：未设 CRON_TOKEN / token 不匹配时，admin 角色 fallback 可调
 *
 * 干什么：扫 status=queued 超过 60s 没人接走（典型 Node 重启场景）
 * 和 status=running 超过 10min 没完成（典型进程崩溃场景）的 AsyncJob：
 * - queued 直接调 runAsyncJob 触发（runAsyncJob 内 updateMany 原子认领，多实例并发安全）
 * - running 且 attempts < maxAttempts → 原子重置回 queued + 再跑
 * - running 且达 maxAttempts → 标 failed
 *
 * 不依赖部署 cron 设施：未设 CRON_TOKEN 的环境，admin 可手动跑作为兜底。
 * 同时支持 GET / POST（Vercel cron 默认 GET，调试用 POST 都行）。
 */
async function handleCron(request: NextRequest) {
  const cronToken = process.env.CRON_TOKEN;
  const headerToken = request.headers.get("x-cron-token");

  if (cronToken && headerToken === cronToken) {
    try {
      const result = await sweepStuckJobs();
      return success(result);
    } catch (err) {
      return handleServiceError(err);
    }
  }

  const session = await getSession();
  if (!session?.user || session.user.role !== "admin") {
    return error("UNAUTHORIZED", "需要 cron token 或 admin 角色", 401);
  }

  try {
    const result = await sweepStuckJobs();
    return success(result);
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
