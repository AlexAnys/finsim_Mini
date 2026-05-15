import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export interface AiUsageFilters {
  feature?: string;
  provider?: string;
  model?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AiRunListItem {
  id: string;
  feature: string;
  provider: string;
  model: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstUSD: number | null;
  latencyMs: number | null;
  summary: string | null;
  error: string | null;
  createdAt: Date;
  userId: string;
  userEmail: string | null;
  userName: string | null;
}

export interface AiUsageAggregate {
  feature: string;
  count: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  /** 缺失 cost 表的模型计入 */
  runsWithoutCost: number;
}

/**
 * 列出 AI 调用记录。
 *
 * 范围由调用方传入：teacher 自己看自己时传 userId；admin 全局看时不传。
 */
export async function listAiRuns(
  scope: { userId?: string } & AiUsageFilters,
  options: { take?: number; skip?: number } = {},
): Promise<{ items: AiRunListItem[]; total: number }> {
  const where: Prisma.AiRunWhereInput = {};
  if (scope.userId) where.userId = scope.userId;
  if (scope.feature) where.feature = scope.feature;
  if (scope.provider) where.provider = scope.provider;
  if (scope.model) where.model = scope.model;
  if (scope.dateFrom || scope.dateTo) {
    where.createdAt = {};
    if (scope.dateFrom) where.createdAt.gte = scope.dateFrom;
    if (scope.dateTo) where.createdAt.lte = scope.dateTo;
  }

  const [rows, total] = await Promise.all([
    prisma.aiRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.take ?? 50,
      skip: options.skip ?? 0,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.aiRun.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      feature: r.feature,
      provider: r.provider,
      model: r.model,
      status: r.status,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costEstUSD: r.costEstUSD != null ? Number(r.costEstUSD) : null,
      latencyMs: r.latencyMs,
      summary: r.summary,
      error: r.error,
      createdAt: r.createdAt,
      userId: r.userId,
      userEmail: r.user?.email ?? null,
      userName: r.user?.name ?? null,
    })),
    total,
  };
}

/**
 * 按 feature 聚合 token + 成本估算。
 *
 * 主要用于 /teacher/ai-usage 顶部成本卡。
 */
export async function aggregateAiUsageByFeature(
  scope: { userId?: string } & AiUsageFilters,
): Promise<AiUsageAggregate[]> {
  const where: Prisma.AiRunWhereInput = { status: "succeeded" };
  if (scope.userId) where.userId = scope.userId;
  if (scope.feature) where.feature = scope.feature;
  if (scope.provider) where.provider = scope.provider;
  if (scope.model) where.model = scope.model;
  if (scope.dateFrom || scope.dateTo) {
    where.createdAt = {};
    if (scope.dateFrom) where.createdAt.gte = scope.dateFrom;
    if (scope.dateTo) where.createdAt.lte = scope.dateTo;
  }

  const rows = await prisma.aiRun.findMany({
    where,
    select: {
      feature: true,
      inputTokens: true,
      outputTokens: true,
      costEstUSD: true,
    },
    take: 10_000,
  });

  const agg = new Map<string, AiUsageAggregate>();
  for (const r of rows) {
    let entry = agg.get(r.feature);
    if (!entry) {
      entry = {
        feature: r.feature,
        count: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUSD: 0,
        runsWithoutCost: 0,
      };
      agg.set(r.feature, entry);
    }
    entry.count++;
    entry.totalInputTokens += r.inputTokens ?? 0;
    entry.totalOutputTokens += r.outputTokens ?? 0;
    if (r.costEstUSD == null) {
      entry.runsWithoutCost++;
    } else {
      entry.totalCostUSD += Number(r.costEstUSD);
    }
  }

  return Array.from(agg.values()).sort((a, b) => b.totalCostUSD - a.totalCostUSD);
}
