-- CreateEnum
CREATE TYPE "ReleaseMode" AS ENUM ('manual', 'auto');

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TaskInstance" ADD COLUMN     "autoReleaseAt" TIMESTAMP(3),
ADD COLUMN     "releaseMode" "ReleaseMode" NOT NULL DEFAULT 'manual';
