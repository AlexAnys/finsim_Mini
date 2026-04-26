import { NextRequest } from "next/server";
import { autoReleaseSubmissions } from "@/lib/services/release.service";
import { getSession } from "@/lib/auth/guards";
import { success, error, handleServiceError } from "@/lib/api-utils";

/**
 * PR-SIM-1a D1: cron 自动公布扫描
 *
 * 双触发模式：
 * 1) 部署 cron（Vercel cron / 系统 cron）：x-cron-token header 匹配 env CRON_TOKEN → 直通
 * 2) admin 手动调用：未设 CRON_TOKEN（开发环境）/ token 不匹配时，admin 角色也可调（fallback）
 *
 * 不依赖部署 cron 设施 — 没设 CRON_TOKEN 的环境，admin 可手动跑。
 *
 * 同时支持 GET 和 POST（Vercel cron 默认 GET，手动调试用 POST 都行）。
 */
async function handleCron(request: NextRequest) {
  const cronToken = process.env.CRON_TOKEN;
  const headerToken = request.headers.get("x-cron-token");

  // Token 匹配 → 直通（生产 cron 路径）
  if (cronToken && headerToken === cronToken) {
    try {
      const result = await autoReleaseSubmissions();
      return success(result);
    } catch (err) {
      return handleServiceError(err);
    }
  }

  // Token 不匹配 → fallback 到 admin 手动触发
  const session = await getSession();
  if (!session?.user || session.user.role !== "admin") {
    return error("UNAUTHORIZED", "需要 cron token 或 admin 角色", 401);
  }

  try {
    const result = await autoReleaseSubmissions();
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
