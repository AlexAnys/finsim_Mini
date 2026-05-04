-- AlterTable
ALTER TABLE "AnalysisReport" ADD COLUMN "scopeHash" TEXT;
ALTER TABLE "AnalysisReport" ADD COLUMN "scopeSummary" JSONB;

-- CreateIndex
CREATE INDEX "AnalysisReport_scopeHash_idx" ON "AnalysisReport"("scopeHash");
