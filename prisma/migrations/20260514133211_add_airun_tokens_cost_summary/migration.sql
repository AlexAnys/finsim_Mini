-- AlterTable
ALTER TABLE "AiRun" ADD COLUMN     "costEstUSD" DECIMAL(10,6),
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "summary" VARCHAR(200);
