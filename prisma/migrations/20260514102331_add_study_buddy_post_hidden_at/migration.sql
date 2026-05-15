-- AlterTable
ALTER TABLE "StudyBuddyPost" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenBy" TEXT;

-- CreateIndex
CREATE INDEX "StudyBuddyPost_hiddenAt_idx" ON "StudyBuddyPost"("hiddenAt");
