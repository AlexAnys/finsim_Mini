import { prisma } from "@/lib/db/prisma";
import { teacherCourseFilter } from "@/lib/services/course.service";
import type { CreateTaskInstanceInput, UpdateTaskInstanceInput } from "@/lib/validators/task.schema";

async function isAuthorizedForInstance(instance: { createdBy: string; courseId: string | null }, userId: string): Promise<boolean> {
  if (instance.createdBy === userId) return true;
  if (!instance.courseId) return false;
  const collab = await prisma.courseTeacher.findUnique({
    where: { courseId_teacherId: { courseId: instance.courseId, teacherId: userId } },
  });
  return !!collab;
}

export async function createTaskInstance(createdBy: string, input: CreateTaskInstanceInput) {
  return prisma.taskInstance.create({
    data: {
      title: input.title,
      description: input.description,
      taskId: input.taskId,
      taskType: input.taskType,
      classId: input.classId,
      groupIds: input.groupIds,
      courseId: input.courseId,
      chapterId: input.chapterId,
      sectionId: input.sectionId,
      slot: input.slot as "pre" | "in" | "post" | undefined,
      dueAt: new Date(input.dueAt),
      publishAt: input.publishAt ? new Date(input.publishAt) : undefined,
      attemptsAllowed: input.attemptsAllowed,
      createdBy,
    },
  });
}

export async function publishTaskInstance(instanceId: string, createdBy: string) {
  const instance = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    include: {
      task: {
        include: {
          simulationConfig: true,
          quizConfig: true,
          subjectiveConfig: true,
          scoringCriteria: { orderBy: { order: "asc" } },
          allocationSections: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
          quizQuestions: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!instance || !(await isAuthorizedForInstance(instance, createdBy))) {
    throw new Error("FORBIDDEN");
  }
  if (instance.status !== "draft") {
    throw new Error("INVALID_STATUS");
  }

  // 冻结任务快照
  const taskSnapshot = JSON.parse(JSON.stringify(instance.task));

  return prisma.taskInstance.update({
    where: { id: instanceId },
    data: {
      status: "published",
      publishedAt: new Date(),
      taskSnapshot,
    },
  });
}

export async function getTaskInstances(filters: {
  courseId?: string;
  classId?: string;
  status?: string;
  createdBy?: string;
}) {
  return prisma.taskInstance.findMany({
    where: {
      ...(filters.courseId && { courseId: filters.courseId }),
      ...(filters.classId && { classId: filters.classId }),
      ...(filters.status && { status: filters.status as "draft" | "published" | "closed" | "archived" }),
      ...(filters.createdBy && {
        OR: [
          { createdBy: filters.createdBy },
          { course: teacherCourseFilter(filters.createdBy) },
        ],
      }),
    },
    include: {
      task: { select: { id: true, taskName: true, taskType: true } },
      class: { select: { id: true, name: true } },
      course: { select: { id: true, courseTitle: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTaskInstanceById(instanceId: string) {
  return prisma.taskInstance.findUnique({
    where: { id: instanceId },
    include: {
      task: {
        include: {
          simulationConfig: true,
          quizConfig: true,
          subjectiveConfig: true,
          scoringCriteria: { orderBy: { order: "asc" } },
          allocationSections: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
          quizQuestions: { orderBy: { order: "asc" } },
        },
      },
      class: true,
    },
  });
}

export async function updateTaskInstance(
  instanceId: string,
  createdBy: string,
  input: UpdateTaskInstanceInput
) {
  const existing = await prisma.taskInstance.findUnique({ where: { id: instanceId } });
  if (!existing || !(await isAuthorizedForInstance(existing, createdBy))) {
    throw new Error("FORBIDDEN");
  }

  return prisma.taskInstance.update({
    where: { id: instanceId },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.dueAt && { dueAt: new Date(input.dueAt) }),
      ...(input.publishAt && { publishAt: new Date(input.publishAt) }),
      ...(input.attemptsAllowed !== undefined && { attemptsAllowed: input.attemptsAllowed }),
      ...(input.groupIds && { groupIds: input.groupIds }),
      ...(input.status && { status: input.status }),
    },
  });
}

export async function deleteTaskInstance(instanceId: string, createdBy: string) {
  const existing = await prisma.taskInstance.findUnique({ where: { id: instanceId } });
  if (!existing || !(await isAuthorizedForInstance(existing, createdBy))) {
    throw new Error("FORBIDDEN");
  }
  return prisma.taskInstance.delete({ where: { id: instanceId } });
}
