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
 * - 限频（AC6 + AC13 原子化）：count + create 包在事务里，事务起手取 **per-user Postgres
 *   advisory 事务锁**（pg_advisory_xact_lock）串行化同一用户的并发提交 —— 消除 count-then-create
 *   的 TOCTOU 竞态，并发也不会突破 FEEDBACK_RATE_LIMIT。锁随事务结束自动释放。
 * - 截图大小（AC5 + AC12）：store-limit 与 DoS-limit 分离。**反馈永不因截图大小丢失** ——
 *   超 store-limit 由本层丢图传 null 但反馈照常落库（LIVE 兜底，非死代码）；route Zod 只用
 *   宽松 DoS 上限拦绝对畸形 payload。
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

  // AC12 LIVE 兜底：截图超 store-limit → 丢图传 null，但反馈照常落库（绝不因截图大小拒反馈）。
  // 空串/缺省也归一为 null。> store-limit 且 <= DoS-limit 的截图走到这里被丢（route Zod 已放行）。
  const screenshot =
    typeof input.screenshot === "string" &&
    input.screenshot.length > 0 &&
    input.screenshot.length <= FEEDBACK_SCREENSHOT_MAX_CHARS
      ? input.screenshot
      : null;

  const windowStart = new Date(Date.now() - FEEDBACK_RATE_WINDOW_MS);

  // AC13 原子限频：事务 + per-user advisory 事务锁串行化同一用户的 count→create，
  // 消除 TOCTOU（并发提交不会都读到 count<limit 后各自插入而突破上限）。锁随 tx 结束释放。
  return prisma.$transaction(async (tx) => {
    // 用 $executeRaw（非 $queryRaw）：pg_advisory_xact_lock 返回 void，$queryRaw 反序列化 void 报错。
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${author.id}, 0))`;
    const recentCount = await tx.feedback.count({
      where: { userId: author.id, createdAt: { gte: windowStart } },
    });
    if (recentCount >= FEEDBACK_RATE_LIMIT) {
      throw new Error("FEEDBACK_RATE_LIMITED");
    }
    return tx.feedback.create({
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
