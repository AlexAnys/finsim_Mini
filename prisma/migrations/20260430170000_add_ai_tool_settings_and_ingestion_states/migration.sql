-- Extend course material ingestion states for text extraction, OCR, and AI summary fallback.
ALTER TYPE "KnowledgeSourceStatus" ADD VALUE IF NOT EXISTS 'extracting';
ALTER TYPE "KnowledgeSourceStatus" ADD VALUE IF NOT EXISTS 'ocr_required';
ALTER TYPE "KnowledgeSourceStatus" ADD VALUE IF NOT EXISTS 'ocr_processing';
ALTER TYPE "KnowledgeSourceStatus" ADD VALUE IF NOT EXISTS 'ai_summary_failed';

ALTER TYPE "KnowledgeSourceKind" ADD VALUE IF NOT EXISTS 'docx';
ALTER TYPE "KnowledgeSourceKind" ADD VALUE IF NOT EXISTS 'zip';
ALTER TYPE "KnowledgeSourceKind" ADD VALUE IF NOT EXISTS 'image';

CREATE TYPE "AiThinkingLevel" AS ENUM ('disabled', 'enabled');

CREATE TABLE "AiToolSetting" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "toolKey" VARCHAR(80) NOT NULL,
    "model" VARCHAR(120),
    "thinking" "AiThinkingLevel" NOT NULL DEFAULT 'disabled',
    "temperature" DOUBLE PRECISION,
    "systemPromptSuffix" TEXT,
    "enableSearch" BOOLEAN NOT NULL DEFAULT false,
    "strictness" VARCHAR(40),
    "outputStyle" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiToolSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiToolSetting_teacherId_toolKey_key" ON "AiToolSetting"("teacherId", "toolKey");
CREATE INDEX "AiToolSetting_teacherId_idx" ON "AiToolSetting"("teacherId");

ALTER TABLE "AiToolSetting" ADD CONSTRAINT "AiToolSetting_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
