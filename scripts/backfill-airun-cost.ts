/**
 * 回填 AiRun.costEstUSD（人民币 ¥，方案 A 保留历史字段名）。
 *
 * 背景：历史 AiRun 行的 costEstUSD 一直为 null（早期未持久化成本 / 当时价目表缺项）。
 * 价目表改人民币后，本脚本按**新价目表**为已记录 token 的旧行补算成本，让老师的
 * AI 用量页 / admin 审计页显示真实 ¥，而非「成本未估算」。
 *
 * 复用 lib/services/ai.service.ts 导出的 estimateCostUSD（同一价目表，避免表漂移）。
 *
 * 幂等：只回填 costEstUSD 为 null 且 inputTokens / outputTokens 至少一个非空的行；
 *       已有成本值的行一律不动。重复跑无副作用。
 * 模型不在价目表 → estimateCostUSD 返回 null → 跳过（仍记为 null，符合「未知成本」语义）。
 *
 * 用法：
 *   npx tsx scripts/backfill-airun-cost.ts --dry-run   # 只打印将更新条数 + 合计 ¥，不写库
 *   npx tsx scripts/backfill-airun-cost.ts             # 实际写库
 *
 * ⚠️ 默认连 DATABASE_URL 指向的库。本次只在 dev 库跑；生产库等用户明确 GO。
 */
import { PrismaClient } from "@prisma/client";
import { estimateCostUSD } from "@/lib/services/ai.service";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[backfill-airun-cost] 模式：${dryRun ? "DRY RUN（不写库）" : "实际写库"}`);

  // 候选：成本为 null 且至少有一项 token 数据。
  const rows = await prisma.aiRun.findMany({
    where: {
      costEstUSD: null,
      OR: [{ inputTokens: { not: null } }, { outputTokens: { not: null } }],
    },
    select: { id: true, model: true, inputTokens: true, outputTokens: true },
  });

  let updated = 0;
  let skippedUnknownModel = 0;
  let totalCny = 0;
  const samples: Array<{ model: string; cost: number }> = [];

  for (const row of rows) {
    const cost = estimateCostUSD(
      row.model,
      row.inputTokens ?? undefined,
      row.outputTokens ?? undefined,
    );
    if (cost === null) {
      // 模型不在价目表 → 维持 null（未知成本），不写。
      skippedUnknownModel++;
      continue;
    }
    totalCny += cost;
    if (samples.length < 5) samples.push({ model: row.model, cost });

    if (!dryRun) {
      await prisma.aiRun.update({
        where: { id: row.id },
        data: { costEstUSD: cost },
      });
    }
    updated++;
  }

  console.log(`候选行（null 成本 + 有 token）：${rows.length}`);
  console.log(`${dryRun ? "将回填" : "已回填"}：${updated} 行`);
  console.log(`跳过（模型不在价目表，维持 null）：${skippedUnknownModel} 行`);
  console.log(`合计成本：¥${totalCny.toFixed(4)}`);
  if (samples.length > 0) {
    console.log("样本：");
    for (const s of samples) {
      console.log(`  ${s.model} → ¥${s.cost.toFixed(6)}`);
    }
  }
  if (dryRun) {
    console.log("（DRY RUN，未写库；去掉 --dry-run 实际执行）");
  }
}

main()
  .catch((err) => {
    console.error("[backfill-airun-cost] 失败：", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
