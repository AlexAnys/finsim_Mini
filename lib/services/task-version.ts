import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export const gradingTaskInclude = {
  simulationConfig: true, quizConfig: true, subjectiveConfig: true,
  scoringCriteria: { orderBy: { order: "asc" } },
  quizQuestions: { orderBy: { order: "asc" } },
  allocationSections: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
} satisfies Prisma.TaskInclude;
export type GradingTask = Prisma.TaskGetPayload<{ include: typeof gradingTaskInclude }>;

/** JSON snapshots preserve the IDs the student was shown. */
export function resolveGradingTask<T extends { taskName: string; taskType: string }>(snapshot: unknown, liveTask: T): T {
  if (snapshot && typeof snapshot === "object" && "taskName" in snapshot && "taskType" in snapshot) {
    return snapshot as T;
  }
  return liveTask;
}
export function freezeTask(task: GradingTask): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(task)) as Prisma.InputJsonValue;
}

export async function loadInstanceGradingTask(instanceId: string) {
  const instance = await prisma.taskInstance.findUnique({ where: { id: instanceId }, include: { task: { include: gradingTaskInclude } } });
  if (!instance) throw new Error("INSTANCE_NOT_FOUND");
  return resolveGradingTask(instance.taskSnapshot, instance.task);
}
