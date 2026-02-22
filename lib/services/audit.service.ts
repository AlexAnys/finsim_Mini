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
