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
 *
 * Unit 3 加 opts.allowClosedWithOwnSubmission：当学生有本人 submission 时，对
 * closed 实例放行只读访问（仅 GET 详情用，提交/聊天/eval 路径保持 strict）。
 * 错误码细分让前端能渲染区分性的 Forbidden 文案：
 * - TASK_INSTANCE_DRAFT_NOT_VISIBLE: 任务未发布
 * - TASK_INSTANCE_CLOSED_NO_SUBMISSION: 任务已关闭且学生无提交
 * - FORBIDDEN: 跨班 / 无 classId 等
 */
export async function assertTaskInstanceReadable(
  instanceId: string,
  user: UserLike,
  opts: { allowClosedWithOwnSubmission?: boolean } = {},
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
      // F1：用于学生分支拒绝已归档课程的实例（teacher/owner 分支保持开放以便恢复）
      course: { select: { deletedAt: true } },
    },
  });
  if (!inst) throw new Error("INSTANCE_NOT_FOUND");

  if (user.role === "student") {
    if (!user.classId) throw new Error("FORBIDDEN");
    if (inst.classId !== user.classId) throw new Error("FORBIDDEN");
    // F1：实例所属课程已归档 → 学生不可访问（即便实例 status 仍是 published）
    if (inst.course && inst.course.deletedAt !== null) throw new Error("FORBIDDEN");
    if (inst.status === "published") return;
    if (inst.status === "draft") throw new Error("TASK_INSTANCE_DRAFT_NOT_VISIBLE");
    if (inst.status === "closed" && opts.allowClosedWithOwnSubmission) {
      const hasOwnSub = await prisma.submission.findFirst({
        where: { taskInstanceId: instanceId, studentId: user.id },
        select: { id: true },
      });
      if (hasOwnSub) return;
      throw new Error("TASK_INSTANCE_CLOSED_NO_SUBMISSION");
    }
    // closed without opt-in, archived, etc.
    throw new Error("FORBIDDEN");
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

/**
 * Assert teacher/admin can mutate a TaskInstance.
 * - admin: bypass
 * - student: rejected
 * - teacher: createdBy === user.id 或通过 instance.courseId 走 assertCourseAccess（owner/collab）
 *
 * 用于 PR-SIM-1a D1 release / unrelease / set-release-mode 这类教师写端。
 */
export async function assertTaskInstanceWritable(
  instanceId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  if (user.role === "student") throw new Error("FORBIDDEN");
  const inst = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, courseId: true, createdBy: true },
  });
  if (!inst) throw new Error("INSTANCE_NOT_FOUND");
  if (inst.createdBy === user.id) return;
  if (inst.courseId) {
    await assertCourseAccess(inst.courseId, user.id, user.role);
    return;
  }
  throw new Error("FORBIDDEN");
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
// Private files
// ============================================

/**
 * Assert readability of a locally stored file path. A file must be referenced
 * by either a submitted attachment or an import job before it can be served.
 */
export async function assertFileReadable(
  filePath: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;

  const attachment = await prisma.attachment.findFirst({
    where: { filePath },
    select: {
      subjectiveSubmission: {
        select: { submissionId: true },
      },
    },
  });
  if (attachment) {
    await assertSubmissionReadable(
      attachment.subjectiveSubmission.submissionId,
      user,
    );
    return;
  }

  const importJob = await prisma.importJob.findFirst({
    where: { filePath },
    select: { teacherId: true },
  });
  if (importJob) {
    if (importJob.teacherId === user.id) return;
    throw new Error("FORBIDDEN");
  }

  throw new Error("FILE_NOT_FOUND");
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

// ============================================
// Chapter / Section / ContentBlock (write-side guards for PR-4D1)
// ============================================

/**
 * Assert teacher/admin can mutate a Chapter.
 * Resolves via chapter.courseId + assertCourseAccess (owner or collab).
 * Students are rejected outright.
 */
export async function assertChapterWritable(
  chapterId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  if (user.role === "student") throw new Error("FORBIDDEN");
  const ch = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, courseId: true },
  });
  if (!ch) throw new Error("CHAPTER_NOT_FOUND");
  await assertCourseAccess(ch.courseId, user.id, user.role);
}

/**
 * Assert teacher/admin can mutate a Section.
 * Resolves via section.courseId + assertCourseAccess.
 */
export async function assertSectionWritable(
  sectionId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  if (user.role === "student") throw new Error("FORBIDDEN");
  const sec = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, courseId: true },
  });
  if (!sec) throw new Error("SECTION_NOT_FOUND");
  await assertCourseAccess(sec.courseId, user.id, user.role);
}

/**
 * Assert teacher/admin can mutate a ContentBlock.
 * Resolves via block.courseId + assertCourseAccess.
 */
export async function assertContentBlockWritable(
  blockId: string,
  user: UserLike,
): Promise<void> {
  if (user.role === "admin") return;
  if (user.role === "student") throw new Error("FORBIDDEN");
  const block = await prisma.contentBlock.findUnique({
    where: { id: blockId },
    select: { id: true, courseId: true },
  });
  if (!block) throw new Error("BLOCK_NOT_FOUND");
  await assertCourseAccess(block.courseId, user.id, user.role);
}
