import { prisma } from "@/lib/db/prisma";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task.schema";

// ============================================
// PR-FIX-4 D1: 兼容旧 5 档 [MOOD:] 模板
// ============================================

/**
 * 剥除 systemPrompt 中残留的旧 5 档 [MOOD:] 指令块
 * （PR-7B 已切到 8 档 JSON 协议，运行时由 ai.service.chatReply 注入）。
 *
 * 匹配模式：
 * - 整段 `\n\n【情绪标签】\n在每条回复末尾附加：[MOOD: ...]\n- HAPPY: ... - ANGRY: ...`
 * - 落单的 `[MOOD: HAPPY|NEUTRAL|...]` 列表残片
 *
 * 不动 transcript 里的 [MOOD:] tag（那是 evaluation 阶段的 legacy data，
 * lib/services/ai.service.ts evaluation prompt 仍兼容处理）。
 */
export function stripLegacyMoodBlock(prompt: string | null | undefined): string | undefined {
  if (!prompt) return undefined;
  let cleaned = prompt;
  // 1) 整段【情绪标签】块：从【情绪标签】开始，吃到下一个【块】之前，或字符串末尾。
  //    这样 5 档 [MOOD:] 列表 + 5 行 - HAPPY/.../- ANGRY 全清。
  cleaned = cleaned.replace(
    /\s*【情绪标签】[\s\S]*?(?=\n\s*【|$)/g,
    "",
  );
  // 2) 兜底：落单的 [MOOD: HAPPY|NEUTRAL|... ] 列表残片（无【情绪标签】块）
  cleaned = cleaned.replace(
    /\s*\[MOOD:\s*HAPPY\s*\|[^\]]*\]\s*/g,
    " ",
  );
  // 3) 末尾"在每条回复末尾附加"残句
  cleaned = cleaned.replace(
    /\s*在每条回复末尾附加[：:][^\n]*\n?/g,
    "",
  );
  // 4) "- HAPPY:" / "- NEUTRAL:" / "- CONFUSED:" / "- SKEPTICAL:" / "- ANGRY:" 5 档残行（如果【情绪标签】块没把它们包含进来的兜底）
  cleaned = cleaned.replace(
    /\n\s*-\s*(?:HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY)[：:][^\n]*/g,
    "",
  );
  cleaned = cleaned.trim();
  return cleaned === "" ? undefined : cleaned;
}

/**
 * 对 simulationConfig 输入做 D1 兼容处理：仅 strip systemPrompt 字段，
 * 其他字段 byte-EQ 透传。教师编辑保存（update）/ 新建（create）入口都走这个函数。
 */
function sanitizeSimulationConfig<
  T extends { systemPrompt?: string | null } | undefined,
>(config: T): T {
  if (!config) return config;
  const cleaned = stripLegacyMoodBlock(config.systemPrompt);
  if (cleaned === config.systemPrompt) return config;
  return { ...config, systemPrompt: cleaned };
}

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
      const safeConfig = sanitizeSimulationConfig(input.simulationConfig);
      await tx.simulationConfig.create({
        data: { taskId: task.id, ...safeConfig },
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
      const safeConfig = sanitizeSimulationConfig(input.simulationConfig);
      await tx.simulationConfig.upsert({
        where: { taskId },
        create: { taskId, ...safeConfig },
        update: safeConfig,
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
