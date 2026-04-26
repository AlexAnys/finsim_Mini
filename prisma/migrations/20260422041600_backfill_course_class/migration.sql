-- Backfill CourseClass rows for courses that existed before the multi-class migration.
-- Idempotent: ON CONFLICT DO NOTHING respects the (courseId, classId) unique index.

-- gen_random_uuid() requires the pgcrypto extension. Some minimal Postgres
-- provisions (fresh container without contrib loaded) ship without it, which
-- would make this migration fail on first run. Ensure it's available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "CourseClass" ("id", "courseId", "classId", "createdAt")
SELECT gen_random_uuid()::text, "id", "classId", COALESCE("createdAt", NOW())
FROM "Course"
WHERE "classId" IS NOT NULL
ON CONFLICT ("courseId", "classId") DO NOTHING;
