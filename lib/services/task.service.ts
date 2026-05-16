import { prisma } from "@/lib/db/prisma";
import { clampTake } from "@/lib/pagination";
import { logAuditEvent } from "@/lib/services/audit.service";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task.schema";
import type { Prisma } from "@prisma/client";

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

export async function createTaskInTransaction(
  tx: Prisma.TransactionClient,
  creatorId: string,
  input: CreateTaskInput,
) {
    // 1. 创建 Task 主记录
    const task = await tx.task.create({
      data: {
        taskType: input.taskType,
        taskName: input.taskName,
        requirements: input.requirements,
        practiceEnabled: input.practiceEnabled,
        creatorId,
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
}

export async function createTask(creatorId: string, input: CreateTaskInput) {
  const task = await prisma.$transaction((tx) =>
    createTaskInTransaction(tx, creatorId, input),
  );
  // Unit 8: adaptive quiz 任务创建后自动触发知识点 tagging（异步，不阻塞）
  if (
    input.taskType === "quiz" &&
    input.quizConfig?.mode === "adaptive" &&
    (input.quizQuestions?.length ?? 0) > 0
  ) {
    try {
      const { enqueueAsyncJob } = await import("./async-job.service");
      await enqueueAsyncJob({
        type: "quiz_question_tag",
        entityType: "task",
        entityId: task.id,
        input: { taskId: task.id },
        createdBy: creatorId,
      });
    } catch (err) {
      console.error("[createTask] 自动触发 quiz_question_tag 失败（不阻塞）：", err);
    }
  }
  return task;
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

export async function getTasksByCreator(
  creatorId: string,
  options: { take?: number } = {},
) {
  return prisma.task.findMany({
    where: { creatorId },
    include: {
      scoringCriteria: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(options.take, 100, 200),
  });
}

export async function updateTask(taskId: string, creatorId: string, input: UpdateTaskInput) {
  // 验证归属
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, creatorId: true, taskName: true, taskType: true, requirements: true },
  });
  if (!existing || existing.creatorId !== creatorId) {
    throw new Error("FORBIDDEN");
  }

  // Unit 4 高危拦截：若 task 有 >=1 graded submission，且客户端未明确 force=true，则拒绝
  const { force, ...patchData } = input;
  const gradedCount = await prisma.submission.count({
    where: { taskId, status: "graded" },
  });
  if (gradedCount > 0 && !force) {
    const err = new Error("TASK_HAS_GRADED_SUBMISSIONS") as Error & { gradedCount?: number };
    err.gradedCount = gradedCount;
    throw err;
  }

  // before 关键字段（写入 audit log，避免整 JSON 入库）
  const beforeQuestionCount = await prisma.quizQuestion.count({ where: { taskId } });
  const beforeCriteriaCount = await prisma.scoringCriterion.count({ where: { taskId } });

  const updated = await prisma.$transaction(async (tx) => {
    // 更新主记录
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        taskName: patchData.taskName,
        requirements: patchData.requirements,
        practiceEnabled: patchData.practiceEnabled,
      },
    });

    // 更新类型专属配置
    if (patchData.simulationConfig && existing.taskType === "simulation") {
      const safeConfig = sanitizeSimulationConfig(patchData.simulationConfig);
      await tx.simulationConfig.upsert({
        where: { taskId },
        create: { taskId, ...safeConfig },
        update: safeConfig,
      });
    }
    if (patchData.quizConfig && existing.taskType === "quiz") {
      await tx.quizConfig.upsert({
        where: { taskId },
        create: { taskId, ...patchData.quizConfig },
        update: patchData.quizConfig,
      });
    }
    if (patchData.subjectiveConfig && existing.taskType === "subjective") {
      await tx.subjectiveConfig.upsert({
        where: { taskId },
        create: { taskId, ...patchData.subjectiveConfig },
        update: patchData.subjectiveConfig,
      });
    }

    // 更新评分标准（全量替换）
    if (patchData.scoringCriteria) {
      await tx.scoringCriterion.deleteMany({ where: { taskId } });
      if (patchData.scoringCriteria.length > 0) {
        await tx.scoringCriterion.createMany({
          data: patchData.scoringCriteria.map((c) => ({ taskId, ...c })),
        });
      }
    }

    // 更新资产配置（全量替换）
    if (patchData.allocationSections) {
      await tx.allocationSection.deleteMany({ where: { taskId } });
      for (const section of patchData.allocationSections) {
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
    if (patchData.quizQuestions) {
      await tx.quizQuestion.deleteMany({ where: { taskId } });
      if (patchData.quizQuestions.length > 0) {
        await tx.quizQuestion.createMany({
          data: patchData.quizQuestions.map((q) => ({
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

  // Unit 4 audit log — 紧凑 diff，避免整 JSON 入库
  await logAuditEvent({
    action: "task.update",
    actorRole: "owner",
    actorId: creatorId,
    targetId: taskId,
    targetType: "Task",
    metadata: {
      fieldsChanged: Object.keys(patchData),
      hadGradedSubmissions: gradedCount > 0,
      gradedCount,
      force: !!force,
      before: {
        taskName: existing.taskName,
        requirements: existing.requirements,
        questionCount: beforeQuestionCount,
        criteriaCount: beforeCriteriaCount,
      },
      after: {
        taskName: patchData.taskName ?? existing.taskName,
        questionCount: patchData.quizQuestions
          ? patchData.quizQuestions.length
          : beforeQuestionCount,
        criteriaCount: patchData.scoringCriteria
          ? patchData.scoringCriteria.length
          : beforeCriteriaCount,
      },
    },
  });

  // Phase3-A · Root cause 2: updateTask 重建 quizQuestions（line 319 deleteMany）后，
  // 所有 knowledgeTagIds 都被清空。仅当 patchData.quizQuestions 真改 + adaptive 模式 + 有题时
  // 才 re-enqueue tagger（避免改无关字段也烧 AI cost）。
  const quizQuestionsChanged =
    patchData.quizQuestions !== undefined && patchData.quizQuestions.length > 0;
  if (existing.taskType === "quiz" && quizQuestionsChanged) {
    const liveConfig = await prisma.quizConfig.findUnique({
      where: { taskId },
      select: { mode: true },
    });
    const mode = patchData.quizConfig?.mode ?? liveConfig?.mode;
    if (mode === "adaptive") {
      try {
        const { enqueueAsyncJob } = await import("./async-job.service");
        await enqueueAsyncJob({
          type: "quiz_question_tag",
          entityType: "task",
          entityId: taskId,
          input: { taskId },
          createdBy: creatorId,
        });
      } catch (err) {
        console.error(
          "[updateTask] 自动触发 quiz_question_tag 失败（不阻塞）：",
          err,
        );
      }
    }
  }

  return updated;
}

export async function deleteTask(taskId: string, creatorId: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, creatorId: true, taskName: true },
  });
  if (!existing) throw new Error("TASK_NOT_FOUND");
  if (existing.creatorId !== creatorId) throw new Error("FORBIDDEN");

  // Unit 5a: 拒删有 instance 的 task（实例已派给班级，删了会破坏学生作答）
  const instanceCount = await prisma.taskInstance.count({ where: { taskId } });
  if (instanceCount > 0) {
    const err = new Error("TASK_HAS_INSTANCES") as Error & { instanceCount?: number };
    err.instanceCount = instanceCount;
    throw err;
  }

  await prisma.task.delete({ where: { id: taskId } });
  await logAuditEvent({
    action: "task.delete",
    actorRole: "owner",
    actorId: creatorId,
    targetId: taskId,
    targetType: "Task",
    metadata: { taskName: existing.taskName },
  });
}
