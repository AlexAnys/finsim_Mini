import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/services/audit.service";
import { Prisma } from "@prisma/client";
import { clampTake } from "@/lib/pagination";
import type { SlotType, ContentBlockType } from "@prisma/client";

// ============================================
// 协作教师过滤器
// ============================================

export function teacherCourseScope(teacherId: string): Prisma.CourseWhereInput {
  return { OR: [{ createdBy: teacherId }, { teachers: { some: { teacherId } } }] };
}

// U3-F3：归档集中过滤 —— teacherCourseFilter/courseClassFilter 一律附加 deletedAt: null，
// 使 dashboard/announcement/schedule/SB 等读取点一处生效，已归档课程自动从老师/学生面消失。
// 回收站列表查询走 teacherCourseScope（不含 deletedAt）+ 显式 deletedAt:{not:null} 绕过本过滤。
export function teacherCourseFilter(teacherId: string): Prisma.CourseWhereInput {
  return { AND: [teacherCourseScope(teacherId), { deletedAt: null }] };
}

// 班级课程过滤器：通过 CourseClass M:N 关联匹配。Course.classId 已弃用 + writer 不再写入，
// 旧 row 在 migration 时已 backfill 到 CourseClass，因此单源即可。
export function courseClassFilter(classId: string): Prisma.CourseWhereInput {
  return { AND: [{ classes: { some: { classId } } }, { deletedAt: null }] };
}

// ============================================
// 批量访问检查
// ============================================

/**
 * 校验用户可访问所有给定课程。admin 直通，其他必须是 creator 或 CourseTeacher。
 * 任一课程不可访问即抛 FORBIDDEN；课程不存在抛 COURSE_NOT_FOUND。
 */
export async function assertCourseAccessBulk(
  courseIds: string[],
  userId: string,
  userRole: string
) {
  if (userRole === "admin") return;
  if (courseIds.length === 0) return;

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, createdBy: true },
  });
  if (courses.length !== courseIds.length) throw new Error("COURSE_NOT_FOUND");

  const nonOwned = courses.filter((c) => c.createdBy !== userId).map((c) => c.id);
  if (nonOwned.length === 0) return;

  const teacherRows = await prisma.courseTeacher.findMany({
    where: { courseId: { in: nonOwned }, teacherId: userId },
    select: { courseId: true },
  });
  const collaboratingIds = new Set(teacherRows.map((r) => r.courseId));
  for (const cid of nonOwned) {
    if (!collaboratingIds.has(cid)) throw new Error("FORBIDDEN");
  }
}

// ============================================
// 课程 CRUD
// ============================================

export async function createCourse(data: {
  courseTitle: string;
  courseCode?: string;
  description?: string;
  classId: string;
  createdBy: string;
}) {
  // 同事务创建 Course + 首个 CourseClass，保证不会出现"course 没 class"中间态。
  // Course.classId 已弃用，writer 不再写入，单一关联在 CourseClass。
  return prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        courseTitle: data.courseTitle,
        courseCode: data.courseCode,
        description: data.description,
        createdBy: data.createdBy,
      },
    });
    await tx.courseClass.create({
      data: { courseId: course.id, classId: data.classId },
    });
    return course;
  });
}

export async function getCoursesByTeacher(
  teacherId: string,
  options: { take?: number } = {},
) {
  return prisma.course.findMany({
    where: teacherCourseFilter(teacherId),
    include: {
      class: true,
      classes: { include: { class: true } },
      creator: { select: { id: true, name: true, email: true } },
      teachers: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
        },
      },
      // Unit 5a: 列表卡片需要 chapter/instance count 来判断"是否可删"+ dialog 预览
      _count: { select: { chapters: true, taskInstances: true } },
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(options.take, 100, 200),
  });
}

/**
 * 批量更新课程的学期开始日期。全成功或全失败（事务）。
 * 任一课程无权限或不存在 → 抛错，不做任何修改。
 */
export async function batchUpdateSemesterStart(
  courseIds: string[],
  startDate: Date,
  userId: string,
  userRole: string
) {
  if (courseIds.length === 0) throw new Error("EMPTY_COURSE_LIST");
  await assertCourseAccessBulk(courseIds, userId, userRole);
  return prisma.$transaction(
    courseIds.map((id) =>
      prisma.course.update({
        where: { id },
        data: { semesterStartDate: startDate },
      })
    )
  );
}

// ============================================
// CourseTeacher CRUD
// ============================================

export async function addCourseTeacher(courseId: string, teacherEmail: string) {
  const teacher = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!teacher) throw new Error("USER_NOT_FOUND");
  if (teacher.role !== "teacher" && teacher.role !== "admin") throw new Error("NOT_A_TEACHER");

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (course.createdBy === teacher.id) throw new Error("ALREADY_OWNER");

  return prisma.courseTeacher.create({
    data: { courseId, teacherId: teacher.id },
    include: { teacher: { select: { id: true, name: true, email: true } } },
  });
}

export async function removeCourseTeacher(courseId: string, teacherId: string) {
  return prisma.courseTeacher.delete({
    where: { courseId_teacherId: { courseId, teacherId } },
  });
}

export async function getCourseTeachers(courseId: string) {
  return prisma.courseTeacher.findMany({
    where: { courseId },
    include: { teacher: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// ============================================
// CourseClass CRUD
// ============================================

export async function addCourseClass(courseId: string, classId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("CLASS_NOT_FOUND");

  return prisma.courseClass.create({
    data: { courseId, classId },
    include: { class: true },
  });
}

export async function removeCourseClass(courseId: string, classId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  // 至少保留 1 个 CourseClass — 防止 course 失去所有班级关联（无班级的 course 列表查询会消失）。
  const remaining = await prisma.courseClass.count({
    where: { courseId, NOT: { classId } },
  });
  if (remaining === 0) throw new Error("MUST_KEEP_AT_LEAST_ONE_CLASS");

  return prisma.courseClass.delete({
    where: { courseId_classId: { courseId, classId } },
  });
}

export async function getCourseClasses(courseId: string) {
  return prisma.courseClass.findMany({
    where: { courseId },
    include: { class: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCoursesByClass(
  classId: string,
  options: { take?: number } = {},
) {
  return prisma.course.findMany({
    where: courseClassFilter(classId),
    include: { class: true, classes: { include: { class: true } } },
    orderBy: { createdAt: "desc" },
    take: clampTake(options.take, 100, 200),
  });
}

export async function getCourseWithStructure(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      class: true,
      classes: { include: { class: true } },
      chapters: {
        orderBy: { order: "asc" },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              contentBlocks: {
                orderBy: [{ slot: "asc" }, { order: "asc" }],
              },
              taskInstances: {
                where: { status: { in: ["published", "draft"] } },
                orderBy: { createdAt: "desc" },
              },
              taskBuildDrafts: {
                where: {
                  // publish-flow: approved 是 with-task 已接受的合法待发布态，必须在课程结构里露出来，
                  // 否则「批准全部」(ready→approved) 后草稿从小节消失 + 发布按钮成死代码。
                  status: { in: ["draft", "queued", "processing", "ready", "approved", "failed"] },
                },
                orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              },
            },
          },
        },
      },
    },
  });
}

// ============================================
// 章节 CRUD
// ============================================

export async function createChapter(data: {
  courseId: string;
  title: string;
  order: number;
  createdBy: string;
}) {
  return prisma.chapter.create({ data });
}

export async function getChaptersByCourse(courseId: string) {
  return prisma.chapter.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
  });
}

export async function updateChapter(
  id: string,
  patch: { title?: string; order?: number }
) {
  const data: { title?: string; order?: number } = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.order !== undefined) data.order = patch.order;
  if (Object.keys(data).length === 0) throw new Error("EMPTY_PATCH");
  return prisma.chapter.update({ where: { id }, data });
}

export async function deleteChapter(id: string) {
  return prisma.chapter.delete({ where: { id } });
}

// ============================================
// 小节 CRUD
// ============================================

export async function createSection(data: {
  courseId: string;
  chapterId: string;
  title: string;
  order: number;
  createdBy: string;
}) {
  return prisma.section.create({ data });
}

export async function updateSection(
  id: string,
  patch: { title?: string; order?: number }
) {
  const data: { title?: string; order?: number } = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.order !== undefined) data.order = patch.order;
  if (Object.keys(data).length === 0) throw new Error("EMPTY_PATCH");
  return prisma.section.update({ where: { id }, data });
}

export async function deleteSection(id: string) {
  return prisma.section.delete({ where: { id } });
}

// ============================================
// 内容块 CRUD
// ============================================

export async function upsertMarkdownBlock(data: {
  courseId: string;
  chapterId: string;
  sectionId: string;
  slot: SlotType;
  content: string;
}) {
  const blockType: ContentBlockType = "markdown";
  const existing = await prisma.contentBlock.findFirst({
    where: {
      sectionId: data.sectionId,
      slot: data.slot,
      blockType,
    },
  });

  if (existing) {
    return prisma.contentBlock.update({
      where: { id: existing.id },
      data: { data: { content: data.content } },
    });
  }

  const maxOrder = await prisma.contentBlock.aggregate({
    where: { sectionId: data.sectionId, slot: data.slot },
    _max: { order: true },
  });

  return prisma.contentBlock.create({
    data: {
      courseId: data.courseId,
      chapterId: data.chapterId,
      sectionId: data.sectionId,
      slot: data.slot,
      blockType,
      order: (maxOrder._max.order ?? -1) + 1,
      data: { content: data.content },
    },
  });
}

export async function createContentBlock(data: {
  courseId: string;
  chapterId: string;
  sectionId: string;
  slot: SlotType;
  blockType: ContentBlockType;
  payload?: Prisma.InputJsonValue;
}) {
  // Validate that section actually belongs to the given chapter+course (prevents cross-course tampering)
  const section = await prisma.section.findUnique({
    where: { id: data.sectionId },
    select: { courseId: true, chapterId: true },
  });
  if (!section) throw new Error("SECTION_NOT_FOUND");
  if (section.courseId !== data.courseId || section.chapterId !== data.chapterId) {
    throw new Error("SECTION_PARENT_MISMATCH");
  }

  const maxOrder = await prisma.contentBlock.aggregate({
    where: { sectionId: data.sectionId, slot: data.slot },
    _max: { order: true },
  });

  return prisma.contentBlock.create({
    data: {
      courseId: data.courseId,
      chapterId: data.chapterId,
      sectionId: data.sectionId,
      slot: data.slot,
      blockType: data.blockType,
      order: (maxOrder._max.order ?? -1) + 1,
      data: data.payload ?? Prisma.JsonNull,
    },
  });
}

export async function updateContentBlock(
  id: string,
  patch: { payload?: Prisma.InputJsonValue; order?: number }
) {
  const data: Prisma.ContentBlockUpdateInput = {};
  if (patch.payload !== undefined) data.data = patch.payload;
  if (patch.order !== undefined) data.order = patch.order;
  if (Object.keys(data).length === 0) throw new Error("EMPTY_PATCH");
  return prisma.contentBlock.update({ where: { id }, data });
}

export async function deleteContentBlock(id: string) {
  return prisma.contentBlock.delete({ where: { id } });
}

/**
 * 批量调序：输入 [{id, order}]，在一个事务里更新所有 block 的 order。
 * 调用方需先 assert 每个 block 的 writable（endpoint 做）。
 * 若 id 集合跨多个 section，调序仍各自独立（schema 上 ContentBlock 无 @@unique 约束，允许）。
 */
export async function reorderContentBlocks(
  items: Array<{ id: string; order: number }>
) {
  if (items.length === 0) return [];
  return prisma.$transaction(
    items.map((it) =>
      prisma.contentBlock.update({
        where: { id: it.id },
        data: { order: it.order },
      })
    )
  );
}


// ============================================
// 课程归档（软删除）/ 恢复 / 彻底删除
// ============================================

/**
 * 归档/恢复/彻底删除共用的 owner-or-admin 守卫。
 * - admin 直通（可操作任意课程）
 * - 否则必须是 createdBy（协作教师不含归档/删除权）
 * 返回课程的最小字段（含 deletedAt，便于 caller 判断状态 + audit 写标题）。
 * 课程不存在 → COURSE_NOT_FOUND；非 owner 非 admin → FORBIDDEN。
 */
async function assertCourseOwnerOrAdmin(
  courseId: string,
  userId: string,
  userRole: string,
) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, courseTitle: true, createdBy: true, deletedAt: true },
  });
  if (!course) throw new Error("COURSE_NOT_FOUND");
  if (userRole !== "admin" && course.createdBy !== userId) {
    throw new Error("FORBIDDEN");
  }
  return course;
}

/**
 * 归档课程（软删除）：置 deletedAt 时间戳。
 * - 无须先清空章节/实例（归档不销毁数据 → 可恢复，故不要 COURSE_HAS_* 闸）
 * - owner（createdBy）或 admin 可操作（D3）
 * - 写 audit course.archive
 * 替代了旧的硬删 deleteCourse —— DELETE /courses/[id] 现走此函数。
 */
export async function archiveCourse(
  courseId: string,
  userId: string,
  userRole: string,
) {
  const course = await assertCourseOwnerOrAdmin(courseId, userId, userRole);
  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { deletedAt: new Date() },
  });
  await logAuditEvent({
    action: "course.archive",
    actorRole: userRole === "admin" ? "admin" : "owner",
    actorId: userId,
    targetId: courseId,
    targetType: "Course",
    metadata: { title: course.courseTitle },
  });
  return updated;
}

/**
 * 恢复已归档课程：清空 deletedAt（不动任务实例本身，D1）。
 * - owner 或 admin
 * - 写 audit course.restore
 */
export async function restoreCourse(
  courseId: string,
  userId: string,
  userRole: string,
) {
  const course = await assertCourseOwnerOrAdmin(courseId, userId, userRole);
  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { deletedAt: null },
  });
  await logAuditEvent({
    action: "course.restore",
    actorRole: userRole === "admin" ? "admin" : "owner",
    actorId: userId,
    targetId: courseId,
    targetType: "Course",
    metadata: { title: course.courseTitle },
  });
  return updated;
}

/**
 * 回收站列表：仅返回已归档课程（deletedAt 非空）。
 * - teacher：自己创建或协作的已归档课程（teacherCourseFilter）
 * - admin：全部已归档课程
 * include 对齐 getCoursesByTeacher，供回收站卡片展示。
 */
export async function getArchivedCourses(
  userId: string,
  userRole: string,
  options: { take?: number } = {},
) {
  const where: Prisma.CourseWhereInput =
    userRole === "admin"
      ? { deletedAt: { not: null } }
      : { AND: [{ deletedAt: { not: null } }, teacherCourseScope(userId)] };

  return prisma.course.findMany({
    where,
    include: {
      class: true,
      classes: { include: { class: true } },
      creator: { select: { id: true, name: true, email: true } },
      teachers: {
        include: { teacher: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { chapters: true, taskInstances: true } },
    },
    orderBy: { deletedAt: "desc" },
    take: clampTake(options.take, 100, 200),
  });
}

/**
 * 彻底删除课程（真销毁，不可恢复）。
 * - owner 或 admin（D3）
 * - 需输入课程名强确认：confirmTitle 必须与 courseTitle 完全一致，否则 PURGE_TITLE_MISMATCH（D4）
 * - 即使有已批改提交也允许（D4）
 * - 事务内按 FK 承重次序删除全部后代（spec §8），不删共享 Task 模板（F5）
 * - 写 audit course.purge（含被删后代计数）
 *
 * 为何显式删 SET NULL 关系（Submission/TaskInstance/StudyBuddyPost/AnalysisReport）：
 * 这些 FK 是 ON DELETE SET NULL，靠 DB 级联只会把外键置空产生孤儿行，必须显式删。
 * RESTRICT 关系（Section/ContentBlock.courseId）不显式删会直接挡住 course.delete()。
 */
export async function purgeCourse(
  courseId: string,
  userId: string,
  userRole: string,
  confirmTitle: string,
) {
  const course = await assertCourseOwnerOrAdmin(courseId, userId, userRole);
  if (confirmTitle !== course.courseTitle) {
    throw new Error("PURGE_TITLE_MISMATCH");
  }

  const counts = await prisma.$transaction(async (tx) => {
    // ---- 先解析 id 集 ----
    const chapters = await tx.chapter.findMany({
      where: { courseId },
      select: { id: true },
    });
    const sections = await tx.section.findMany({
      where: { courseId },
      select: { id: true },
    });
    const instances = await tx.taskInstance.findMany({
      where: { courseId },
      select: { id: true },
    });
    const instanceIds = instances.map((i) => i.id);

    const submissions = instanceIds.length
      ? await tx.submission.findMany({
          where: { taskInstanceId: { in: instanceIds } },
          select: { id: true },
        })
      : [];
    const submissionIds = submissions.map((s) => s.id);

    const subjectiveSubs = submissionIds.length
      ? await tx.subjectiveSubmission.findMany({
          where: { submissionId: { in: submissionIds } },
          select: { id: true },
        })
      : [];
    const subjectiveSubIds = subjectiveSubs.map((s) => s.id);

    // ---- 按 §8 承重次序删除 ----
    // 1. attachment（by subjectiveSubmissionIds）
    if (subjectiveSubIds.length) {
      await tx.attachment.deleteMany({
        where: { subjectiveSubmissionId: { in: subjectiveSubIds } },
      });
    }
    // 2. sim/quiz/subjective submission（by submissionIds）——本可由 Submission Cascade，
    //    但显式删求确定性 + 不依赖级联行为
    if (submissionIds.length) {
      await tx.simulationSubmission.deleteMany({
        where: { submissionId: { in: submissionIds } },
      });
      await tx.quizSubmission.deleteMany({
        where: { submissionId: { in: submissionIds } },
      });
      await tx.subjectiveSubmission.deleteMany({
        where: { submissionId: { in: submissionIds } },
      });
    }
    // 3. studyBuddyPost（taskInstanceId in instanceIds 或 courseId=X）/ taskPost /
    //    analysisReport / submission（by instanceIds）
    await tx.studyBuddyPost.deleteMany({
      where: {
        OR: [
          { courseId },
          ...(instanceIds.length ? [{ taskInstanceId: { in: instanceIds } }] : []),
        ],
      },
    });
    if (instanceIds.length) {
      await tx.taskPost.deleteMany({
        where: { taskInstanceId: { in: instanceIds } },
      });
      await tx.analysisReport.deleteMany({
        where: { taskInstanceId: { in: instanceIds } },
      });
    }
    const delSubmissions = submissionIds.length
      ? await tx.submission.deleteMany({
          where: { id: { in: submissionIds } },
        })
      : { count: 0 };
    // 4. courseKnowledgeSource / taskBuildDraft（courseId=X）
    await tx.courseKnowledgeSource.deleteMany({ where: { courseId } });
    await tx.taskBuildDraft.deleteMany({ where: { courseId } });
    // 5. taskInstance（courseId=X — SET NULL，必须显式删）
    const delInstances = await tx.taskInstance.deleteMany({ where: { courseId } });
    // 6. contentBlock（courseId=X）← 解 ContentBlock RESTRICT
    await tx.contentBlock.deleteMany({ where: { courseId } });
    // 7. section（courseId=X）← 解 Section RESTRICT
    await tx.section.deleteMany({ where: { courseId } });
    // 8. chapter（courseId=X）
    await tx.chapter.deleteMany({ where: { courseId } });
    // 9. announcement / scheduleSlot / courseTeacher / courseClass（多为 Cascade，显式删求确定性）
    await tx.announcement.deleteMany({ where: { courseId } });
    await tx.scheduleSlot.deleteMany({ where: { courseId } });
    await tx.courseTeacher.deleteMany({ where: { courseId } });
    await tx.courseClass.deleteMany({ where: { courseId } });
    // 10. course
    await tx.course.delete({ where: { id: courseId } });

    return {
      chapters: chapters.length,
      sections: sections.length,
      instances: delInstances.count,
      submissions: delSubmissions.count,
    };
  });

  await logAuditEvent({
    action: "course.purge",
    actorRole: userRole === "admin" ? "admin" : "owner",
    actorId: userId,
    targetId: courseId,
    targetType: "Course",
    metadata: { title: course.courseTitle, ...counts },
  });

  return counts;
}
