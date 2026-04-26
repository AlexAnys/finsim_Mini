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
