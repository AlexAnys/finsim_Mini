-- DropForeignKey
ALTER TABLE "StudyBuddyPost" DROP CONSTRAINT "StudyBuddyPost_taskId_fkey";

-- AlterTable
ALTER TABLE "StudyBuddyPost" ADD COLUMN     "courseId" TEXT,
ALTER COLUMN "taskId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "StudyBuddyPost_courseId_idx" ON "StudyBuddyPost"("courseId");

-- AddForeignKey
ALTER TABLE "StudyBuddyPost" ADD CONSTRAINT "StudyBuddyPost_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBuddyPost" ADD CONSTRAINT "StudyBuddyPost_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
