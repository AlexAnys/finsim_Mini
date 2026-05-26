import { prisma } from "@/lib/db/prisma";
import type { Feedback, FeedbackStatus, FeedbackType, Role } from "@prisma/client";
import { FEEDBACK_SCREENSHOT_MAX_CHARS } from "@/lib/feedback/constants";

/**
 * 用户反馈服务（报告问题 / 想要功能）。
 *
 * - createFeedback：任意登录用户提交，含 DB-count 限频（防一人狂刷，AC6）。
 * - listFeedback / updateFeedbackStatus：仅供管理员收件箱（auth 在 route 层）。
 *
 * 设计取舍：
 * - 限频用 DB count（按 userId + 时间窗），而非内存 Map —— 可测、跨实例稳健。
 * - 截图大小契约：**客户端保证 ≤ 上限**，route 层 Zod 以同一上限作硬防线。本层
 *   仅做最后防御性归一化（空串/缺省 → null；超大值已被 Zod 拦在门外，正常不可达）。
 */

/** 限频窗口：每个用户 60 秒内最多提交 FEEDBACK_RATE_LIMIT 条。 */
export const FEEDBACK_RATE_WINDOW_MS = 60_000;
export const FEEDBACK_RATE_LIMIT = 5;

// 截图上限单一真源在 lib/feedback/constants（客户端 + Zod + 本层共用）；re-export 保持既有 import 不破。
export { FEEDBACK_SCREENSHOT_MAX_CHARS };

type Author = { id: string; role: string };

export interface CreateFeedbackInput {
  type: FeedbackType;
  content: string;
  pageUrl: string;
  screenshot?: string | null;
  recentErrors?: unknown;
  context?: unknown; // r3 AC10/11 定位上下文
  viewport?: string | null;
  userAgent?: string | null;
}

/**
 * 创建一条反馈。先限频，再清洗截图，最后落库。
 *
 * 抛错（交 handleServiceError 映射）：
 * - FEEDBACK_CONTENT_EMPTY：正文为空 / 全空白
 * - FEEDBACK_RATE_LIMITED：限频窗口内已达上限
 */
export async function createFeedback(
  input: CreateFeedbackInput,
  author: Author,
): Promise<Feedback> {
  const content = (input.content ?? "").trim();
  if (!content) {
    throw new Error("FEEDBACK_CONTENT_EMPTY");
  }

  const windowStart = new Date(Date.now() - FEEDBACK_RATE_WINDOW_MS);
  const recentCount = await prisma.feedback.count({
    where: { userId: author.id, createdAt: { gte: windowStart } },
  });
  if (recentCount >= FEEDBACK_RATE_LIMIT) {
    throw new Error("FEEDBACK_RATE_LIMITED");
  }

  // 截图归一化：空串/缺省 → null。大小由上游（客户端降采样 + route 层 Zod max）强制，
  // 此处 <= 上限判断是最后防御线（正常客户端不可达），保留以防绕过 route 直调 service。
  const screenshot =
    typeof input.screenshot === "string" &&
    input.screenshot.length > 0 &&
    input.screenshot.length <= FEEDBACK_SCREENSHOT_MAX_CHARS
      ? input.screenshot
      : null;

  return prisma.feedback.create({
    data: {
      userId: author.id,
      userRole: author.role as Role,
      type: input.type,
      content,
      pageUrl: input.pageUrl,
      screenshot,
      recentErrors:
        input.recentErrors === undefined
          ? undefined
          : (input.recentErrors as never),
      context:
        input.context === undefined ? undefined : (input.context as never),
      viewport: input.viewport ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export interface FeedbackListItem {
  id: string;
  userId: string;
  userRole: Role;
  type: FeedbackType;
  content: string;
  pageUrl: string;
  screenshot: string | null;
  recentErrors: unknown;
  context: unknown;
  viewport: string | null;
  userAgent: string | null;
  status: FeedbackStatus;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
}

/**
 * 管理员收件箱列表：跨用户全部反馈，按时间倒序，支持 status / type 筛选。
 */
export async function listFeedback(
  filters: { status?: FeedbackStatus; type?: FeedbackType } = {},
  options: { take?: number; skip?: number } = {},
): Promise<{ items: FeedbackListItem[]; total: number }> {
  const where: { status?: FeedbackStatus; type?: FeedbackType } = {};
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const take = Math.min(Math.max(options.take ?? 100, 1), 200);
  const skip = Math.max(options.skip ?? 0, 0);

  const [rows, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.feedback.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userRole: r.userRole,
      type: r.type,
      content: r.content,
      pageUrl: r.pageUrl,
      screenshot: r.screenshot ?? null,
      recentErrors: r.recentErrors ?? null,
      context: r.context ?? null,
      viewport: r.viewport ?? null,
      userAgent: r.userAgent ?? null,
      status: r.status,
      createdAt: r.createdAt,
      userName: r.user?.name ?? null,
      userEmail: r.user?.email ?? null,
    })),
    total,
  };
}

/**
 * 标记反馈处理状态（new / handled）。
 *
 * 抛错：FEEDBACK_NOT_FOUND（反馈不存在）。
 */
export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<Feedback> {
  const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new Error("FEEDBACK_NOT_FOUND");
  }
  return prisma.feedback.update({ where: { id }, data: { status } });
}
