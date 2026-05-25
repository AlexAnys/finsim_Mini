/**
 * 发布策略 seam（纯函数）—— AI 审稿降级为「软提醒」，不再 block 发布。
 *
 * 任务向导第 4 步「创建并发布」的行为由草稿状态决定：
 *   - ready（AI 已生成、未批准）：可发布 + 显示 AI 审稿软提醒（建议核对 AI 题目，提供「去审核」链接）
 *   - draft（手动建任务）：可发布 + 无提醒
 *   - approved（已批准）：可发布 + 无提醒
 *   - 无草稿（null）：可发布 + 无提醒（普通一键创建并发布）
 *   - queued/processing/failed（异步生成中或失败）：不可发布（与 with-task 后端传 draftId 的白名单一致）
 *
 * 注意：本策略只决定「是否显示提醒」，对 ready/draft/approved 一律 canPublish=true，
 * 不构成任何拦截。提醒是 info 级、非阻塞。
 */
export interface PublishPolicy {
  canPublish: boolean;
  showReviewReminder: boolean;
}

// 与 app/api/lms/task-instances/with-task 传 taskBuildDraftId 的白名单一致：
// 只有这些状态会原子 flip → published。
const PUBLISHABLE_DRAFT_STATUSES = new Set(["draft", "ready", "approved"]);

export function getPublishPolicy(status: string | null): PublishPolicy {
  // 无关联草稿：普通一键创建并发布。
  if (status === null) {
    return { canPublish: true, showReviewReminder: false };
  }
  const canPublish = PUBLISHABLE_DRAFT_STATUSES.has(status);
  // 仅 AI 生成、未批准的 ready 草稿显示软提醒。
  const showReviewReminder = status === "ready";
  return { canPublish, showReviewReminder };
}
