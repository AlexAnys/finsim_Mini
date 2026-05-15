-- AlterEnum
ALTER TYPE "TaskBuildDraftStatus" ADD VALUE 'approved';

-- AlterTable
ALTER TABLE "TaskBuildDraft" ADD COLUMN     "aiPayload" JSONB,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "editedPayload" JSONB;

-- backfill: 旧 draft 假设 aiPayload=draftPayload 镜像（避免审核页因 aiPayload=null 拒登 / demo 失败）
-- 仅 ready/published 态做镜像；draft/queued/processing/failed 还在加工中不动
UPDATE "TaskBuildDraft"
SET "aiPayload" = "draftPayload"
WHERE "draftPayload" IS NOT NULL
  AND ("aiPayload" IS NULL OR "aiPayload"::text = 'null')
  AND status IN ('ready', 'published');
