import { prisma } from "@/lib/db/prisma";

export async function logAudit(data: {
  action: string;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}) {
  if (process.env.ENABLE_AUDIT_LOGS !== "true") return;

  try {
    await prisma.auditLog.create({ data: data as Parameters<typeof prisma.auditLog.create>[0]["data"] });
  } catch (error) {
    // 审计日志失败不应阻塞主流程
    console.error("审计日志写入失败:", error);
  }
}

/**
 * PR-FIX-1 UX5: 安全敏感写入（DELETE/PATCH course/chapter/section/contentBlock + grade）
 * 强制写 audit，不依赖 ENABLE_AUDIT_LOGS env，满足合规追责需求。
 *
 * 写入失败仍不阻塞主流程（catch + console.error），但 env 不能跳过。
 */
export async function logAuditForced(data: {
  action: string;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({ data: data as Parameters<typeof prisma.auditLog.create>[0]["data"] });
  } catch (error) {
    console.error("强制审计日志写入失败:", error);
  }
}


/**
 * Unit 11 · admin/audit 列表查询。
 *
 * 跨教师 AuditLog，按时间倒序，支持 action / actorId / dateRange 筛选。
 */
export interface AuditLogListItem {
  id: string;
  action: string;
  actorId: string | null;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  actorEmail: string | null;
  actorName: string | null;
}

export async function listAuditLogs(
  filters: {
    action?: string;
    actorId?: string;
    targetType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {},
  options: { take?: number; skip?: number } = {},
): Promise<{ items: AuditLogListItem[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {};
    if (filters.dateFrom) range.gte = filters.dateFrom;
    if (filters.dateTo) range.lte = filters.dateTo;
    where.createdAt = range;
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.take ?? 50,
      skip: options.skip ?? 0,
      include: { actor: { select: { id: true, email: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorId: r.actorId ?? null,
      targetId: r.targetId ?? null,
      targetType: r.targetType ?? null,
      metadata: r.metadata as Record<string, unknown> | null,
      createdAt: r.createdAt,
      actorEmail: r.actor?.email ?? null,
      actorName: r.actor?.name ?? null,
    })),
    total,
  };
}
