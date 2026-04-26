-- PR-FIX-2 B6: AnalysisReport.taskInstanceId 加唯一约束（一 instance ↔ 一 report）
-- 替换原 @@index([taskInstanceId]) → @@unique([taskInstanceId])，
-- 让 insights.service.ts 可以走 prisma.analysisReport.upsert 替代 findFirst+create/update。
-- DB 已 0 dup rows + 0 total rows 验证 → 安全 add unique。

-- DropIndex
DROP INDEX IF EXISTS "AnalysisReport_taskInstanceId_idx";

-- CreateIndex (unique)
CREATE UNIQUE INDEX "AnalysisReport_taskInstanceId_key" ON "AnalysisReport"("taskInstanceId");
