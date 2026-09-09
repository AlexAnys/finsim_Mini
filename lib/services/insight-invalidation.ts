import { Prisma } from "@prisma/client";
import { __clearWeeklyInsightCache } from "./weekly-insight.service";

/** Keep the original report document, but invalidate derived cache fields. */
export async function invalidateSubmissionInsights(
  tx: Prisma.TransactionClient,
  input: { taskId: string; taskInstanceId?: string | null },
) {
  await tx.analysisReport.updateMany({
    where: { OR: [
      { taskId: input.taskId },
      ...(input.taskInstanceId ? [{ taskInstanceId: input.taskInstanceId }] : []),
      // Scope reports lack a relational course key; conservatively invalidate all scopes.
      { scopeHash: { not: null } },
    ] },
    data: { aggregatedAt: null, commonIssues: Prisma.DbNull, scopeSummary: Prisma.DbNull },
  });
  __clearWeeklyInsightCache();
}
