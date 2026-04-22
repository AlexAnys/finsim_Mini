-- Backfill CourseClass rows for courses that existed before the multi-class migration.
-- Idempotent: ON CONFLICT DO NOTHING respects the (courseId, classId) unique index.
INSERT INTO "CourseClass" ("id", "courseId", "classId", "createdAt")
SELECT gen_random_uuid()::text, "id", "classId", COALESCE("createdAt", NOW())
FROM "Course"
WHERE "classId" IS NOT NULL
ON CONFLICT ("courseId", "classId") DO NOTHING;
