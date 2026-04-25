-- AlterTable
ALTER TABLE "AnalysisReport" ADD COLUMN     "aggregatedAt" TIMESTAMP(3),
ADD COLUMN     "commonIssues" JSONB;

-- AlterTable
ALTER TABLE "QuizSubmission" ADD COLUMN     "conceptTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SimulationSubmission" ADD COLUMN     "conceptTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SubjectiveSubmission" ADD COLUMN     "conceptTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
