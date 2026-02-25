-- CreateTable
CREATE TABLE "CourseClass" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseClass_classId_idx" ON "CourseClass"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseClass_courseId_classId_key" ON "CourseClass"("courseId", "classId");

-- AddForeignKey
ALTER TABLE "CourseClass" ADD CONSTRAINT "CourseClass_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseClass" ADD CONSTRAINT "CourseClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
