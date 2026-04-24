import { prisma } from "@/lib/db/prisma";
import { assertCourseAccess } from "@/lib/auth/course-access";

/**
 * Resource-level access guards for by-id GET endpoints.
 *
 * Each function throws FORBIDDEN / *_NOT_FOUND (mapped to HTTP by handleServiceError).
 * admin always bypasses. Teacher paths verify owner/collab or course access;
 * student paths verify class membership or submission ownership.
 */

type UserLike = { id: string; role: string; classId?: string | null };

// ============================================
// TaskInstance
// ============================================

/**
 * Assert readability of a TaskInstance. Teacher: via owning course (owner /
 * collab) or createdBy. Student: classId must match instance.classId and the
 * instance must be published. Admin: bypass.
 */
export async function assertTaskInstanceReadable(
  instanceId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  const inst = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      classId: true,
      courseId: true,
      createdBy: true,
      status: true,
    },
  });
  if (!inst) throw new Error("INSTANCE_NOT_FOUND");

  if (user.role === "student") {
    if (!user.classId) throw new Error("FORBIDDEN");
    if (inst.classId !== user.classId) throw new Error("FORBIDDEN");
    if (inst.status !== "published") throw new Error("FORBIDDEN");
    return;
  }

  // teacher path
  if (inst.createdBy === user.id) return;
  if (inst.courseId) {
    // Reuse course access guard. It throws FORBIDDEN on miss.
    await assertCourseAccess(inst.courseId, user.id, user.role);
    return;
  }
  // standalone instance (no course) with different creator: FORBIDDEN
  throw new Error("FORBIDDEN");
}

/**
 * Teacher-only variant: same as assertTaskInstanceReadable but rejects students
 * outright (used for /insights which exposes aggregate data).
 */
export async function assertTaskInstanceReadableTeacherOnly(
  instanceId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "student") throw new Error("FORBIDDEN");
  await assertTaskInstanceReadable(instanceId, user);
}

// ============================================
// Task (template)
// ============================================

/**
 * Assert readability of a Task template. Teacher: creator or any course with
 * an instance of this task where the teacher has course access. Student: must
 * have an assigned (published) TaskInstance where instance.classId matches.
 */
export async function assertTaskReadable(
  taskId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, creatorId: true },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");

  if (user.role === "student") {
    if (!user.classId) throw new Error("FORBIDDEN");
    const hit = await prisma.taskInstance.findFirst({
      where: {
        taskId,
        classId: user.classId,
        status: "published",
      },
      select: { id: true },
    });
    if (!hit) throw new Error("FORBIDDEN");
    return;
  }

  // teacher path
  if (task.creatorId === user.id) return;
  // allow teacher if they have course access via any instance's course
  const instances = await prisma.taskInstance.findMany({
    where: { taskId },
    select: { courseId: true },
  });
  for (const inst of instances) {
    if (!inst.courseId) continue;
    try {
      await assertCourseAccess(inst.courseId, user.id, user.role);
      return;
    } catch {
      // try next
    }
  }
  throw new Error("FORBIDDEN");
}

// ============================================
// Class (roster)
// ============================================

/**
 * Assert teacher can read a class's roster: must be admin OR must teach a
 * course whose classId/CourseClass links to this class.
 */
export async function assertClassAccessForTeacher(
  classId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  if (user.role !== "teacher") throw new Error("FORBIDDEN");

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true },
  });
  if (!cls) throw new Error("CLASS_NOT_FOUND");

  const hit = await prisma.course.findFirst({
    where: {
      OR: [
        { classId, createdBy: user.id },
        { classId, teachers: { some: { teacherId: user.id } } },
        { classes: { some: { classId } }, createdBy: user.id },
        {
          classes: { some: { classId } },
          teachers: { some: { teacherId: user.id } },
        },
      ],
    },
    select: { id: true },
  });
  if (!hit) throw new Error("FORBIDDEN");
}

// ============================================
// Submission
// ============================================

/**
 * Assert readability of a submission. Student: only own submissions. Teacher:
 * via the task's creator OR the instance's course access. Admin: bypass.
 */
export async function assertSubmissionReadable(
  submissionId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      taskId: true,
      taskInstanceId: true,
    },
  });
  if (!sub) throw new Error("SUBMISSION_NOT_FOUND");

  if (user.role === "student") {
    if (sub.studentId !== user.id) throw new Error("FORBIDDEN");
    return;
  }

  // teacher path
  const task = await prisma.task.findUnique({
    where: { id: sub.taskId },
    select: { creatorId: true },
  });
  if (task?.creatorId === user.id) return;

  if (sub.taskInstanceId) {
    const inst = await prisma.taskInstance.findUnique({
      where: { id: sub.taskInstanceId },
      select: { courseId: true, createdBy: true },
    });
    if (inst) {
      if (inst.createdBy === user.id) return;
      if (inst.courseId) {
        try {
          await assertCourseAccess(inst.courseId, user.id, user.role);
          return;
        } catch {
          // fall through
        }
      }
    }
  }
  throw new Error("FORBIDDEN");
}

// ============================================
// ImportJob
// ============================================

/**
 * Assert readability of an ImportJob. Only job.teacherId or admin.
 */
export async function assertImportJobReadable(
  jobId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
    select: { id: true, teacherId: true },
  });
  if (!job) throw new Error("JOB_NOT_FOUND");
  if (job.teacherId !== user.id) throw new Error("FORBIDDEN");
}
