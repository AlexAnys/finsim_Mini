import { prisma } from "@/lib/db/prisma";
import { getCourseActorRole, type CourseActorRole } from "@/lib/auth/actor-role";

export type AuditActorRole = CourseActorRole | "system";

/**
 * PR-1 D: 写审计日志（合规追责）。
 *
 * - default-on：不再读 ENABLE_AUDIT_LOGS env，所有写入都尝试落库
 * - 写入失败仍不阻塞主流程（catch + console.error）
 * - actorRole 必填：caller 显式传（最优），或通过 courseId 自动 fallback 推导
 *
 * 历史：原 logAudit (env-gated) + logAuditForced 已合并为本函数。
 */
export async function logAuditEvent(data: {
  action: string;
  actorRole: AuditActorRole;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}) {
  const mergedMetadata = {
    ...(data.metadata ?? {}),
    actorRole: data.actorRole,
  };
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        actorId: data.actorId,
        targetId: data.targetId,
        targetType: data.targetType,
        metadata: mergedMetadata,
      },
    });
  } catch (error) {
    console.error("审计日志写入失败:", error);
  }
}

/**
 * Caller 没现成 actorRole 时的便捷 wrapper：用 courseId + userRole 推导。
 *
 * 适用：route handler 已知 courseId / userId / user.role 但还没算 actorRole。
 * service-internal caller 若已有 actor role 应直接调 logAuditEvent，省一次 DB 查询。
 */
export async function logAuditEventWithCourseRole(data: {
  action: string;
  actorId: string;
  userRole: string;
  courseId: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}) {
  const actorRole = await getCourseActorRole(data.courseId, data.actorId, data.userRole);
  return logAuditEvent({
    action: data.action,
    actorRole,
    actorId: data.actorId,
    targetId: data.targetId,
    targetType: data.targetType,
    metadata: data.metadata,
  });
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
