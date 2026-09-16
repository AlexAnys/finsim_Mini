import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertClassAccessForTeacher } from "@/lib/auth/resource-access";
import { rosterSchema, type RosterInput } from "@/lib/validators/roster.schema";
import { createGroupInTransaction } from "@/lib/services/group.service";

type Actor = { id: string; role: string };
type Tx = Prisma.TransactionClient;

async function learningImpact(tx: Tx, sourceClassId: string, targetClassId: string, ids: string[], memberships: { studentId: string; groupId: string }[]) {
  const empty = { preservedSubmissions: 0, activeQuizAttempts: 0, pendingAssignments: 0, pendingTasks: [] as { id: string; name: string; studentCount: number }[], lostCourses: [] as { id: string; name: string }[], gainedCourses: [] as { id: string; name: string }[] };
  if (!ids.length) return empty;
  const preservedSubmissions = await tx.submission.count({ where: { studentId: { in: ids } } });
  const activeQuizAttempts = await tx.quizAttempt.count({ where: {
    studentId: { in: ids }, submission: null,
    taskInstance: { classId: sourceClassId, status: "published", OR: [{ courseId: null }, { course: { deletedAt: null } }] },
  } });
  const tasks = await tx.taskInstance.findMany({
    where: { classId: sourceClassId, status: "published", OR: [{ courseId: null }, { course: { deletedAt: null } }] },
    select: { id: true, title: true, groupIds: true, submissions: { where: { studentId: { in: ids }, deletedAt: null }, select: { studentId: true } } },
    orderBy: { id: "asc" },
  });
  const pendingTasks = tasks.map((task) => {
    const submitted = new Set(task.submissions.map((s) => s.studentId));
    const assigned = ids.filter((id) => !task.groupIds.length || memberships.some((m) => m.studentId === id && task.groupIds.includes(m.groupId)));
    return { id: task.id, name: task.title, studentCount: assigned.filter((id) => !submitted.has(id)).length };
  }).filter((task) => task.studentCount > 0);
  const pendingAssignments = pendingTasks.reduce((sum, task) => sum + task.studentCount, 0);
  const courses = await tx.course.findMany({
    where: { deletedAt: null, classes: { some: { classId: { in: [sourceClassId, targetClassId] } } } },
    select: { id: true, courseTitle: true, classes: { select: { classId: true } } }, orderBy: { id: "asc" },
  });
  const onlyIn = (inId: string, outId: string) => courses
    .filter((course) => course.classes.some((c) => c.classId === inId) && !course.classes.some((c) => c.classId === outId))
    .map((course) => ({ id: course.id, name: course.courseTitle }));
  return { preservedSubmissions, activeQuizAttempts, pendingAssignments, pendingTasks, lostCourses: onlyIn(sourceClassId, targetClassId), gainedCourses: onlyIn(targetClassId, sourceClassId) };
}

async function targetGroup(tx: Tx, user: Actor, input: RosterInput) {
  if (!input.targetGroupId && !input.newGroupName) return null;
  const group = await tx.studentGroup.findFirst({
    where: {
      classId: input.targetClassId,
      ...(user.role === "admin" ? {} : { teacherId: user.id }),
      ...(input.targetGroupId ? { id: input.targetGroupId } : { name: input.newGroupName, teacherId: user.id }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  if (input.targetGroupId && !group) throw new Error("FORBIDDEN");
  return group;
}

async function buildPlan(tx: Tx, sourceClassId: string, user: Actor, input: RosterInput) {
  if (input.mode === "group" && sourceClassId !== input.targetClassId) throw new Error("ROSTER_INVALID_INPUT");
  if (input.mode === "transfer" && sourceClassId === input.targetClassId) throw new Error("ROSTER_INVALID_INPUT");
  await assertClassAccessForTeacher(sourceClassId, user, tx);
  if (sourceClassId !== input.targetClassId) await assertClassAccessForTeacher(input.targetClassId, user, tx);
  const sourceClass = await tx.class.findUnique({ where: { id: sourceClassId }, select: { id: true, name: true } });
  const targetClass = sourceClassId === input.targetClassId ? sourceClass
    : await tx.class.findUnique({ where: { id: input.targetClassId }, select: { id: true, name: true } });
  if (!sourceClass || !targetClass) throw new Error("CLASS_NOT_FOUND");
  const ids = [...new Set(input.studentIds)].sort();
  const students = await tx.user.findMany({
    where: { id: { in: ids }, role: "student", classId: { in: [sourceClassId, input.targetClassId] } },
    select: { id: true, name: true, classId: true }, orderBy: { id: "asc" },
  });
  if (students.length !== ids.length) throw new Error("ROSTER_STUDENT_MISMATCH");
  const group = await targetGroup(tx, user, input);
  const memberships = await tx.studentGroupMember.findMany({
    where: { studentId: { in: ids }, group: { classId: sourceClassId, ...(input.mode === "group" && user.role !== "admin" ? { teacherId: user.id } : {}) } },
    select: { id: true, studentId: true, groupId: true }, orderBy: { id: "asc" },
  });
  const changes = students.filter((student) => {
    if (input.mode === "transfer") return student.classId === sourceClassId;
    const member = memberships.filter((m) => m.studentId === student.id);
    return !group || !member.some((m) => m.groupId === group.id)
      || (input.groupMode === "replace" && member.some((m) => m.groupId !== group.id));
  });
  const changedIds = changes.map((student) => student.id);
  const removedMemberships = memberships.filter((m) => changedIds.includes(m.studentId)
    && (input.mode === "transfer" || (input.groupMode === "replace" && m.groupId !== group?.id))).length;
  const learning = await learningImpact(tx, sourceClassId, input.targetClassId, input.mode === "transfer" ? changedIds : [], memberships);
  const warnings: string[] = [];
  const blockers: string[] = [];
  if (input.mode === "transfer") {
    warnings.push(`学生只归属一个班级；转班后退出「${sourceClass.name}」及其全部小组，进入「${targetClass.name}」。`);
    warnings.push("原有学习记录、作业提交和成绩不会删除，仍归属原课程；已公布成绩可在成绩页查看。原班任务详情与作答权限不再开放。");
    if (learning.pendingAssignments) warnings.push(`原班还有 ${learning.pendingAssignments} 人次已发布任务未提交；转班后无法继续这些任务，浏览器内未提交草稿也不会迁入目标班。`);
    if (learning.lostCourses.length) warnings.push(`转班后不再能进入课程：${learning.lostCourses.map((c) => c.name).join("、")}。`);
    if (learning.gainedCourses.length) warnings.push(`转班后可进入目标班课程：${learning.gainedCourses.map((c) => c.name).join("、")}。`);
    if (learning.activeQuizAttempts) blockers.push(`有 ${learning.activeQuizAttempts} 次测验已开始但未提交，请先让学生完成并提交，或由老师关闭对应任务后重新预览。`);
  } else if (input.groupMode === "replace") {
    warnings.push(user.role === "admin" ? "所选学生将退出本班其他小组，再加入目标小组。" : "所选学生将退出你管理的本班其他小组，再加入目标小组；其他老师的小组保持不变。");
  }
  if (input.newGroupName && group) warnings.push(`已存在同名小组「${group.name}」，本次复用该小组。`);
  const plan = {
    canApply: blockers.length === 0, sourceClass, targetClass, targetGroup: group,
    newGroupName: input.newGroupName ?? null, selectedCount: ids.length,
    changeCount: changes.length, skippedCount: ids.length - changes.length,
    students: students.map((student) => ({ id: student.id, name: student.name, status: changedIds.includes(student.id) ? "change" as const : "skip" as const })),
    warnings, blockers, impact: { removedMemberships, ...learning },
  };
  const previewToken = createHash("sha256").update(JSON.stringify({
    actor: user.id, mode: input.mode, groupMode: input.groupMode, plan, memberships,
  })).digest("hex");
  return { plan, changedIds, previewToken };
}

async function applyPlan(tx: Tx, sourceClassId: string, user: Actor, input: RosterInput) {
  // Class locks also serialize inline group creation. Student rows protect overlapping transfers.
  // Lock instance rows before users, matching submission/quiz transaction order.
  const classIds = [...new Set([sourceClassId, input.targetClassId])].sort();
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Class" WHERE id IN (${Prisma.join(classIds)}) ORDER BY id FOR UPDATE`);
  if (input.mode === "transfer") {
    await tx.$queryRaw`SELECT id FROM "TaskInstance" WHERE "classId" = ${sourceClassId} ORDER BY id FOR UPDATE`;
  }
  const ids = [...new Set(input.studentIds)].sort();
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
  const { plan, changedIds, previewToken } = await buildPlan(tx, sourceClassId, user, input);
  const result = { ...plan, previewToken, preview: input.preview, appliedCount: 0, failedCount: 0 };
  if (input.preview) return result;
  if (!plan.canApply) throw new Error("ROSTER_BLOCKED");
  if (!changedIds.length) return result;
  if (input.previewToken !== previewToken) throw new Error("ROSTER_PREVIEW_STALE");

  let group = plan.targetGroup;
  if (!group && input.newGroupName) {
    const created = await createGroupInTransaction(tx, {
      name: input.newGroupName, classId: input.targetClassId, user, type: "manual",
    });
    group = { id: created.id, name: created.name };
  }
  if (input.mode === "transfer") {
    const updated = await tx.user.updateMany({
      where: { id: { in: changedIds }, classId: sourceClassId, role: "student" }, data: { classId: input.targetClassId },
    });
    if (updated.count !== changedIds.length) throw new Error("ROSTER_CONCURRENT_CHANGE");
    await tx.studentGroupMember.deleteMany({ where: { studentId: { in: changedIds }, group: { classId: sourceClassId } } });
  } else if (input.groupMode === "replace") {
    await tx.studentGroupMember.deleteMany({ where: {
      studentId: { in: changedIds }, groupId: { not: group!.id },
      group: { classId: sourceClassId, ...(user.role === "admin" ? {} : { teacherId: user.id }) },
    } });
  }
  if (group) await tx.studentGroupMember.createMany({
    data: changedIds.map((studentId) => ({ groupId: group.id, studentId })), skipDuplicates: true,
  });
  await tx.auditLog.create({ data: {
    action: input.mode === "transfer" ? "class.roster.transfer" : "class.roster.group",
    actorId: user.id, targetType: "Class", targetId: input.targetClassId,
    metadata: { sourceClassId, targetClassId: input.targetClassId, studentIds: changedIds,
      targetGroupId: group?.id ?? null, groupMode: input.groupMode, removedMemberships: plan.impact.removedMemberships },
  } });
  return { ...result, targetGroup: group, appliedCount: changedIds.length };
}

/** All changes are atomic; no learning rows, passwords, or accounts are updated. */
export async function manageClassRoster(sourceClassId: string, user: Actor, input: RosterInput) {
  if (user.role !== "teacher" && user.role !== "admin") throw new Error("FORBIDDEN");
  const parsed = rosterSchema.safeParse(input);
  if (!parsed.success) throw new Error("ROSTER_INVALID_INPUT");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction((tx) => applyPlan(tx, sourceClassId, user, parsed.data), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000,
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2034") throw err;
      if (attempt === 2) throw new Error("ROSTER_CONCURRENT_CHANGE");
    }
  }
  throw new Error("ROSTER_CONCURRENT_CHANGE");
}

export type RosterResult = Awaited<ReturnType<typeof manageClassRoster>>;
