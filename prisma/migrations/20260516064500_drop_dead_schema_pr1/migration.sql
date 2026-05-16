-- PR-1 Candidate I+J: schema 死字段/死表清理 + Course.classId 收敛准备
--
-- 改动:
-- 1. 补 Course → CourseClass backfill（idempotent ON CONFLICT DO NOTHING）—
--    `20260422041600_backfill_course_class` 只跑过一次，对之后新建的 course 不补；
--    需要在改 Course.classId 为 nullable + 收敛 OR pattern 之前确保所有现存
--    Course.classId 都有对应 CourseClass 行，否则 reader 收敛后这些 course 在
--    学生 dashboard 消失。
-- 2. ALTER Course.classId DROP NOT NULL — 配合 code 层的"writer 不再写 classId"。
--    Course.class relation 同步改为 ON DELETE SET NULL（避免删除 Class 时 Course 级联消失）。
-- 3. DROP TABLE TaskInstanceAnalytics — 全仓 0 producer 的死表（dashboard 已用 live 聚合替代）。
-- 4. DROP COLUMN Task.visibility / Task.courseName / Task.chapterName — 写而不读的死字段。
-- 5. DROP TYPE Visibility — 仅 Task.visibility 引用。
-- 6. DROP COLUMN Class.departmentName — 仅 seed 写入，0 reader。

-- ============================================
-- Step 1: 补 backfill（idempotent）
-- ============================================
INSERT INTO "CourseClass" ("id", "courseId", "classId", "createdAt")
SELECT gen_random_uuid()::text, "id", "classId", COALESCE("createdAt", NOW())
FROM "Course"
WHERE "classId" IS NOT NULL
ON CONFLICT ("courseId", "classId") DO NOTHING;

-- ============================================
-- Step 2-7: 自动生成的 schema 改动
-- ============================================

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_classId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstanceAnalytics" DROP CONSTRAINT "TaskInstanceAnalytics_taskInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstanceAnalytics" DROP CONSTRAINT "TaskInstanceAnalytics_taskId_fkey";

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "departmentName";

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "classId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "chapterName",
DROP COLUMN "courseName",
DROP COLUMN "visibility";

-- DropTable
DROP TABLE "TaskInstanceAnalytics";

-- DropEnum
DROP TYPE "Visibility";

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
