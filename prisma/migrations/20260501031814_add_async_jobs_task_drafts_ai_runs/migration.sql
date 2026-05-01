-- CreateEnum
CREATE TYPE "AsyncJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "AsyncJobType" AS ENUM ('knowledge_source_ingest', 'task_draft_generate', 'task_import_parse', 'submission_grade', 'ai_work_assistant', 'analytics_recompute');

-- CreateEnum
CREATE TYPE "TaskBuildDraftStatus" AS ENUM ('draft', 'queued', 'processing', 'ready', 'failed', 'published');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "CourseKnowledgeSource" ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "taskInstanceId" TEXT;

-- CreateTable
CREATE TABLE "AsyncJob" (
    "id" TEXT NOT NULL,
    "type" "AsyncJobType" NOT NULL,
    "status" "AsyncJobStatus" NOT NULL DEFAULT 'queued',
    "entityType" VARCHAR(80),
    "entityId" VARCHAR(120),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBuildDraft" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "chapterId" TEXT,
    "sectionId" TEXT,
    "slot" "SlotType",
    "taskType" "TaskType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "TaskBuildDraftStatus" NOT NULL DEFAULT 'draft',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "draftPayload" JSONB,
    "error" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBuildDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolKey" VARCHAR(80) NOT NULL,
    "feature" VARCHAR(80) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'running',
    "promptVersion" VARCHAR(80),
    "promptHash" VARCHAR(120),
    "inputSize" INTEGER,
    "outputSize" INTEGER,
    "latencyMs" INTEGER,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsyncJob_type_status_idx" ON "AsyncJob"("type", "status");

-- CreateIndex
CREATE INDEX "AsyncJob_entityType_entityId_idx" ON "AsyncJob"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AsyncJob_createdBy_idx" ON "AsyncJob"("createdBy");

-- CreateIndex
CREATE INDEX "TaskBuildDraft_courseId_chapterId_sectionId_idx" ON "TaskBuildDraft"("courseId", "chapterId", "sectionId");

-- CreateIndex
CREATE INDEX "TaskBuildDraft_createdBy_idx" ON "TaskBuildDraft"("createdBy");

-- CreateIndex
CREATE INDEX "TaskBuildDraft_status_idx" ON "TaskBuildDraft"("status");

-- CreateIndex
CREATE INDEX "AiRun_userId_toolKey_idx" ON "AiRun"("userId", "toolKey");

-- CreateIndex
CREATE INDEX "AiRun_feature_status_idx" ON "AiRun"("feature", "status");

-- CreateIndex
CREATE INDEX "AiRun_createdAt_idx" ON "AiRun"("createdAt");

-- CreateIndex
CREATE INDEX "CourseKnowledgeSource_taskId_idx" ON "CourseKnowledgeSource"("taskId");

-- CreateIndex
CREATE INDEX "CourseKnowledgeSource_taskInstanceId_idx" ON "CourseKnowledgeSource"("taskInstanceId");

-- AddForeignKey
ALTER TABLE "CourseKnowledgeSource" ADD CONSTRAINT "CourseKnowledgeSource_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseKnowledgeSource" ADD CONSTRAINT "CourseKnowledgeSource_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncJob" ADD CONSTRAINT "AsyncJob_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBuildDraft" ADD CONSTRAINT "TaskBuildDraft_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBuildDraft" ADD CONSTRAINT "TaskBuildDraft_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBuildDraft" ADD CONSTRAINT "TaskBuildDraft_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBuildDraft" ADD CONSTRAINT "TaskBuildDraft_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
