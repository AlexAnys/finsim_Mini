/**
 * AI feature throttle (in-memory, dev/demo 适用).
 *
 * 用于限制 force=true 强制重新调 AI 的频率（同 userId+feature 60s 内仅 1 次）。
 * 不替代 ai.service 的全局 `checkRateLimit`（按 user×feature 小时计数）；
 * 本 throttle 专门防 "force=true 频繁点击"。
 *
 * 生产 serverless 跨实例需切到 DB 查询（参考 AiRun.createdAt），本 lib 留接口位。
 */

const lastForceCallMap = new Map<string, number>();

export const AI_FEATURE_COOLDOWN_MS = 60_000;

/**
 * 检查并记录一次 force 调用。已在冷却窗口内则抛 AI_FEATURE_COOLDOWN。
 *
 * 抛错后由 handleServiceError 映射 429 + 中文文案。
 */
export function assertAiFeatureCooldown(
  userId: string,
  feature: string,
  cooldownMs: number = AI_FEATURE_COOLDOWN_MS,
): void {
  const key = `${userId}:${feature}`;
  const lastAt = lastForceCallMap.get(key) ?? 0;
  const now = Date.now();
  if (now - lastAt < cooldownMs) {
    throw new Error("AI_FEATURE_COOLDOWN");
  }
  lastForceCallMap.set(key, now);
}

/** Test-only：清空所有冷却记录。 */
export function __clearAiThrottleState() {
  lastForceCallMap.clear();
}
