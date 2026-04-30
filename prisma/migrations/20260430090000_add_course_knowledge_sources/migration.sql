-- CreateEnum
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('uploaded', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "KnowledgeSourceKind" AS ENUM ('pdf', 'text');

-- CreateTable
CREATE TABLE "CourseKnowledgeSource" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "chapterId" TEXT,
    "sectionId" TEXT,
    "teacherId" TEXT NOT NULL,
    "kind" "KnowledgeSourceKind" NOT NULL DEFAULT 'pdf',
    "fileName" VARCHAR(500) NOT NULL,
    "filePath" VARCHAR(1000),
    "mimeType" VARCHAR(120) NOT NULL,
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'uploaded',
    "extractedText" TEXT,
    "summary" TEXT,
    "conceptTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseKnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseKnowledgeSource_courseId_chapterId_sectionId_idx" ON "CourseKnowledgeSource"("courseId", "chapterId", "sectionId");

-- CreateIndex
CREATE INDEX "CourseKnowledgeSource_teacherId_idx" ON "CourseKnowledgeSource"("teacherId");

-- CreateIndex
CREATE INDEX "CourseKnowledgeSource_status_idx" ON "CourseKnowledgeSource"("status");

-- AddForeignKey
ALTER TABLE "CourseKnowledgeSource" ADD CONSTRAINT "CourseKnowledgeSource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseKnowledgeSource" ADD CONSTRAINT "CourseKnowledgeSource_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseKnowledgeSource" ADD CONSTRAINT "CourseKnowledgeSource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseKnowledgeSource" ADD CONSTRAINT "CourseKnowledgeSource_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
