import { prisma } from "@/lib/db/prisma";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task.schema";

// ============================================
// 任务定义 CRUD
// ============================================

export async function createTask(creatorId: string, input: CreateTaskInput) {
  return prisma.$transaction(async (tx) => {
    // 1. 创建 Task 主记录
    const task = await tx.task.create({
      data: {
        taskType: input.taskType,
        taskName: input.taskName,
        requirements: input.requirements,
        visibility: input.visibility,
        practiceEnabled: input.practiceEnabled,
        creatorId,
        courseName: input.courseName,
        chapterName: input.chapterName,
      },
    });

    // 2. 创建类型专属配置
    if (input.taskType === "simulation" && input.simulationConfig) {
      await tx.simulationConfig.create({
        data: { taskId: task.id, ...input.simulationConfig },
      });
    }
    if (input.taskType === "quiz" && input.quizConfig) {
      await tx.quizConfig.create({
        data: { taskId: task.id, ...input.quizConfig },
      });
    }
    if (input.taskType === "subjective" && input.subjectiveConfig) {
      await tx.subjectiveConfig.create({
        data: {
          taskId: task.id,
          ...input.subjectiveConfig,
        },
      });
    }

    // 3. 创建评分标准
    if (input.scoringCriteria?.length) {
      await tx.scoringCriterion.createMany({
        data: input.scoringCriteria.map((c) => ({
          taskId: task.id,
          ...c,
        })),
      });
    }

    // 4. 创建资产配置（仅 simulation）
    if (input.taskType === "simulation" && input.allocationSections?.length) {
      for (const section of input.allocationSections) {
        const created = await tx.allocationSection.create({
          data: {
            taskId: task.id,
            label: section.label,
            order: section.order,
          },
        });
        if (section.items?.length) {
          await tx.allocationItem.createMany({
            data: section.items.map((item) => ({
              sectionId: created.id,
              ...item,
            })),
          });
        }
      }
    }

    // 5. 创建测验题目（仅 quiz）
    if (input.taskType === "quiz" && input.quizQuestions?.length) {
      await tx.quizQuestion.createMany({
        data: input.quizQuestions.map((q) => ({
          taskId: task.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options ?? undefined,
          correctOptionIds: q.correctOptionIds ?? [],
          correctAnswer: q.correctAnswer,
          points: q.points,
          difficulty: q.difficulty,
          explanation: q.explanation,
          order: q.order,
        })),
      });
    }

    return task;
  });
}

export async function getTaskById(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
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
      taskInstances: {
        select: {
          id: true, title: true, status: true, dueAt: true,
          class: { select: { id: true, name: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      creator: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getTasksByCreator(creatorId: string) {
  return prisma.task.findMany({
    where: { creatorId },
    include: {
      scoringCriteria: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateTask(taskId: string, creatorId: string, input: UpdateTaskInput) {
  // 验证归属
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing || existing.creatorId !== creatorId) {
    throw new Error("FORBIDDEN");
  }

  return prisma.$transaction(async (tx) => {
    // 更新主记录
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        taskName: input.taskName,
        requirements: input.requirements,
        visibility: input.visibility,
        practiceEnabled: input.practiceEnabled,
        courseName: input.courseName,
        chapterName: input.chapterName,
      },
    });

    // 更新类型专属配置
    if (input.simulationConfig && existing.taskType === "simulation") {
      await tx.simulationConfig.upsert({
        where: { taskId },
        create: { taskId, ...input.simulationConfig },
        update: input.simulationConfig,
      });
    }
    if (input.quizConfig && existing.taskType === "quiz") {
      await tx.quizConfig.upsert({
        where: { taskId },
        create: { taskId, ...input.quizConfig },
        update: input.quizConfig,
      });
    }
    if (input.subjectiveConfig && existing.taskType === "subjective") {
      await tx.subjectiveConfig.upsert({
        where: { taskId },
        create: { taskId, ...input.subjectiveConfig },
        update: input.subjectiveConfig,
      });
    }

    // 更新评分标准（全量替换）
    if (input.scoringCriteria) {
      await tx.scoringCriterion.deleteMany({ where: { taskId } });
      if (input.scoringCriteria.length > 0) {
        await tx.scoringCriterion.createMany({
          data: input.scoringCriteria.map((c) => ({ taskId, ...c })),
        });
      }
    }

    // 更新资产配置（全量替换）
    if (input.allocationSections) {
      await tx.allocationSection.deleteMany({ where: { taskId } });
      for (const section of input.allocationSections) {
        const created = await tx.allocationSection.create({
          data: { taskId, label: section.label, order: section.order },
        });
        if (section.items?.length) {
          await tx.allocationItem.createMany({
            data: section.items.map((item) => ({
              sectionId: created.id,
              ...item,
            })),
          });
        }
      }
    }

    // 更新测验题目（全量替换）
    if (input.quizQuestions) {
      await tx.quizQuestion.deleteMany({ where: { taskId } });
      if (input.quizQuestions.length > 0) {
        await tx.quizQuestion.createMany({
          data: input.quizQuestions.map((q) => ({
            taskId,
            type: q.type,
            prompt: q.prompt,
            options: q.options ?? undefined,
            correctOptionIds: q.correctOptionIds ?? [],
            correctAnswer: q.correctAnswer,
            points: q.points,
            difficulty: q.difficulty,
            explanation: q.explanation,
            order: q.order,
          })),
        });
      }
    }

    return task;
  });
}

export async function deleteTask(taskId: string, creatorId: string) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing || existing.creatorId !== creatorId) {
    throw new Error("FORBIDDEN");
  }
  return prisma.task.delete({ where: { id: taskId } });
}
