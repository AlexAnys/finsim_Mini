ALTER TABLE "StudyBuddyPost"
ADD COLUMN IF NOT EXISTS "isPreview" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "StudyBuddyPost_isPreview_idx" ON "StudyBuddyPost"("isPreview");
