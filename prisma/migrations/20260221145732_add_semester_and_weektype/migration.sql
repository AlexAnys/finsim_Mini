-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "semesterStartDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN     "weekType" VARCHAR(10) NOT NULL DEFAULT 'all';
