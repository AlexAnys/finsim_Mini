ALTER TYPE "KnowledgeSourceKind" ADD VALUE IF NOT EXISTS 'spreadsheet';

ALTER TABLE "AiToolSetting"
ADD COLUMN IF NOT EXISTS "provider" VARCHAR(40);

ALTER TABLE "CourseKnowledgeSource"
ADD COLUMN IF NOT EXISTS "sourceType" VARCHAR(80),
ADD COLUMN IF NOT EXISTS "structuredData" JSONB,
ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "TaskBuildDraft"
ADD COLUMN IF NOT EXISTS "asyncJobId" VARCHAR(120);

CREATE INDEX IF NOT EXISTS "CourseKnowledgeSource_sourceType_idx" ON "CourseKnowledgeSource"("sourceType");

CREATE INDEX IF NOT EXISTS "TaskBuildDraft_asyncJobId_idx" ON "TaskBuildDraft"("asyncJobId");
