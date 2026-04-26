import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertTaskInstanceReadableTeacherOnly } from "@/lib/auth/resource-access";
import {
  aggregateInsights,
  getCachedInsights,
} from "@/lib/services/insights.service";
import { success, handleServiceError } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertTaskInstanceReadableTeacherOnly(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    const cached = await getCachedInsights(id, user.id);
    return success({
      cached: !!cached,
      ...(cached ?? {
        commonIssues: null,
        aggregatedAt: null,
        studentCount: 0,
        reportId: null,
      }),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

// PR-FIX-1 A8: per-instance mutex（防并发刷 token）
const aggregateInProgress = new Map<string, number>();
const MUTEX_TTL_MS = 5 * 60 * 1000; // 5min — 防止聚合长时间挂起后永久 lock
// PR-FIX-1 A8: 缓存新鲜度阈值。POST 默认走缓存若 < 5min；force=true 才重跑
const CACHE_FRESHNESS_MS = 5 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertTaskInstanceReadableTeacherOnly(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });

    // PR-FIX-1 A8: 解析 force flag（query string + body）
    const { searchParams } = new URL(request.url);
    let force = searchParams.get("force") === "true";
    if (!force) {
      try {
        const body = await request.json().catch(() => null);
        if (body && typeof body === "object" && body.force === true) {
          force = true;
        }
      } catch {
        // body 非 JSON 或为空，按 force=false
      }
    }

    // PR-FIX-1 A8: 默认走缓存（< 5min freshness）
    if (!force) {
      const cached = await getCachedInsights(id, user.id);
      if (cached && cached.aggregatedAt) {
        const ageMs = Date.now() - cached.aggregatedAt.getTime();
        if (ageMs < CACHE_FRESHNESS_MS) {
          return success({ cached: true, ...cached });
        }
      }
    }

    // PR-FIX-1 A8: per-instance mutex（防并发刷 token）
    const lockedAt = aggregateInProgress.get(id);
    if (lockedAt && Date.now() - lockedAt < MUTEX_TTL_MS) {
      throw new Error("AGGREGATE_IN_PROGRESS");
    }
    aggregateInProgress.set(id, Date.now());

    try {
      const aggregated = await aggregateInsights(id, user.id);
      return success({ cached: false, ...aggregated });
    } finally {
      aggregateInProgress.delete(id);
    }
  } catch (err) {
    return handleServiceError(err);
  }
}
