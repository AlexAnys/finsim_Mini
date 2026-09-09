/*
  Warnings:

  - A unique constraint covering the columns `[quizAttemptId]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentId,requestId]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "quizAttemptId" TEXT,
ADD COLUMN     "releaseSuppressedAt" TIMESTAMP(3),
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "taskSnapshot" JSONB;

-- AlterTable
ALTER TABLE "TaskInstance" ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "taskInstanceId" TEXT NOT NULL,
    "taskSnapshot" JSONB NOT NULL,
    "issuedQuestionIds" TEXT[],
    "answers" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_taskInstanceId_idx" ON "QuizAttempt"("studentId", "taskInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_filePath_key" ON "FileUpload"("filePath");

-- CreateIndex
CREATE INDEX "FileUpload_ownerId_idx" ON "FileUpload"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_quizAttemptId_key" ON "Submission"("quizAttemptId");

-- CreateIndex
CREATE INDEX "Submission_deletedAt_idx" ON "Submission"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_studentId_requestId_key" ON "Submission"("studentId", "requestId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_quizAttemptId_fkey" FOREIGN KEY ("quizAttemptId") REFERENCES "QuizAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
