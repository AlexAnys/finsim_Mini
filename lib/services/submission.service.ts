import { prisma } from "@/lib/db/prisma";
import type { CreateSubmissionInput } from "@/lib/validators/submission.schema";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import { clampPage, clampTake } from "@/lib/pagination";

type UserLike = { id: string; role: string; classId?: string | null };

// PR-SIM-1a D1: 防作弊·学生可见数据剥离辅助
//
// "已分析未公布"语义：grading 完成（status=graded）但教师/cron 还没设 releasedAt → 学生看到的对象需剥离
// score / maxScore / evaluation / feedback / rubricBreakdown / conceptTags / scoreDist 等敏感字段。
//
// 派生 analysisStatus：
// - status=submitted/grading && releasedAt=null  → "pending"
// - status=graded && releasedAt=null             → "analyzed_unreleased"
// - status=graded && releasedAt!=null            → "released"
// - status=failed                                → "pending"（视为待重试，UI 处理）
export type SubmissionAnalysisStatus = "pending" | "analyzed_unreleased" | "released";

export function deriveAnalysisStatus(args: {
  status: string;
  releasedAt: Date | null | undefined;
}): SubmissionAnalysisStatus {
  if (args.status === "graded" && args.releasedAt) return "released";
  if (args.status === "graded") return "analyzed_unreleased";
  return "pending";
}

/**
 * 把含 evaluation / score 的 submission 对象剥离敏感字段，得到学生可见版本。
 * 输入对象保持不可变（返回新对象）。
 *
 * 剥离规则：
 * - 顶层 score / maxScore → null
 * - simulationSubmission / quizSubmission / subjectiveSubmission 的 evaluation / conceptTags → null/[]
 * - 不动 transcript / answers / textAnswer / attachments（学生自己提交的内容仍可见）
 * - 总是附 analysisStatus 字段
 *
 * 注：当 releasedAt 非 null 时，此函数仍返回原始数据（仅加 analysisStatus="released"），不剥离。
 */
export function stripSubmissionForStudent<T extends Record<string, unknown>>(submission: T): T & { analysisStatus: SubmissionAnalysisStatus } {
  const status = String((submission as { status?: unknown }).status ?? "");
  const releasedAt = (submission as { releasedAt?: Date | string | null }).releasedAt ?? null;
  const analysisStatus = deriveAnalysisStatus({
    status,
    releasedAt: releasedAt ? new Date(releasedAt) : null,
  });

  if (analysisStatus === "released") {
    return { ...(submission as object), analysisStatus } as T & { analysisStatus: SubmissionAnalysisStatus };
  }

  // pending / analyzed_unreleased: 剥离敏感字段
  const stripped: Record<string, unknown> = { ...submission };
  stripped.score = null;
  stripped.maxScore = null;

  for (const sub of ["simulationSubmission", "quizSubmission", "subjectiveSubmission"] as const) {
    const detail = stripped[sub] as Record<string, unknown> | null | undefined;
    if (detail && typeof detail === "object") {
      stripped[sub] = {
        ...detail,
        evaluation: null,
        conceptTags: [],
      };
    }
  }

  return { ...stripped, analysisStatus } as T & { analysisStatus: SubmissionAnalysisStatus };
}

export async function createSubmission(studentId: string, input: CreateSubmissionInput) {
  // 如果有 taskInstanceId，验证提交条件
  if (input.taskInstanceId) {
    const instance = await prisma.taskInstance.findUnique({
      where: { id: input.taskInstanceId },
    });
    if (!instance) throw new Error("TASK_INSTANCE_NOT_FOUND");
    if (instance.status !== "published") throw new Error("TASK_NOT_PUBLISHED");
    if (new Date() > instance.dueAt) throw new Error("TASK_OVERDUE");

    // 检查尝试次数
    if (instance.attemptsAllowed) {
      const count = await prisma.submission.count({
        where: {
          studentId,
          taskInstanceId: input.taskInstanceId,
        },
      });
      if (count >= instance.attemptsAllowed) throw new Error("MAX_ATTEMPTS_REACHED");
    }
  }

  return prisma.$transaction(async (tx) => {
    // 创建基础提交记录
    const submission = await tx.submission.create({
      data: {
        studentId,
        taskId: input.taskId,
        taskType: input.taskType,
        taskInstanceId: input.taskInstanceId,
        status: "submitted",
      },
    });

    // 创建类型专属记录
    if (input.taskType === "simulation") {
      await tx.simulationSubmission.create({
        data: {
          submissionId: submission.id,
          transcript: input.transcript,
          assets: input.assets ?? undefined,
        },
      });
    } else if (input.taskType === "quiz") {
      await tx.quizSubmission.create({
        data: {
          submissionId: submission.id,
          answers: input.answers,
          startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
          finishedAt: input.finishedAt ? new Date(input.finishedAt) : undefined,
          durationSeconds: input.durationSeconds,
        },
      });
    } else if (input.taskType === "subjective") {
      const subSub = await tx.subjectiveSubmission.create({
        data: {
          submissionId: submission.id,
          textAnswer: input.textAnswer,
        },
      });

      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          await tx.attachment.create({
            data: {
              subjectiveSubmissionId: subSub.id,
              fileName: att.fileName,
              filePath: att.filePath,
              fileSize: att.fileSize,
              contentType: att.contentType,
            },
          });
        }
      }
    }

    return submission;
  });
}

export async function getSubmissions(filters: {
  taskInstanceId?: string;
  studentId?: string;
  taskId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = clampPage(filters.page);
  const pageSize = clampTake(filters.pageSize, 20, 100);
  const skip = (page - 1) * pageSize;

  const where = {
    ...(filters.taskInstanceId && { taskInstanceId: filters.taskInstanceId }),
    ...(filters.studentId && { studentId: filters.studentId }),
    ...(filters.taskId && { taskId: filters.taskId }),
    ...(filters.status && { status: filters.status as "submitted" | "grading" | "graded" | "failed" }),
  };

  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, taskName: true, taskType: true } },
        simulationSubmission: true,
        quizSubmission: true,
        subjectiveSubmission: { include: { attachments: true } },
      },
      orderBy: { submittedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.submission.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getSubmissionById(submissionId: string) {
  return prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: { select: { id: true, name: true, email: true } },
      task: {
        include: {
          scoringCriteria: { orderBy: { order: "asc" } },
          simulationConfig: true,
          quizConfig: true,
          subjectiveConfig: true,
        },
      },
      simulationSubmission: true,
      quizSubmission: true,
      subjectiveSubmission: { include: { attachments: true } },
    },
  });
}

export async function updateSubmissionGrade(
  submissionId: string,
  data: {
    status: "grading" | "graded" | "failed";
    score?: number;
    maxScore?: number;
    evaluation?: Record<string, unknown>;
    conceptTags?: string[];
    /**
     * PR-SIM-1a D1: 由调用方（grading.service / 教师手动批改）显式传入。
     * - 显式 Date：写入对应时刻（auto 模式 immediate release / 教师手工公布）
     * - null：显式撤回（unrelease）
     * - undefined：保持现有 releasedAt 值不变（grading 中间态、grading.service 当前默认）
     */
    releasedAt?: Date | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: data.status,
        score: data.score,
        maxScore: data.maxScore,
        gradedAt: data.status === "graded" ? new Date() : undefined,
        ...(data.releasedAt !== undefined && { releasedAt: data.releasedAt }),
      },
    });

    // 更新类型专属记录的 evaluation + conceptTags
    const hasEval = data.evaluation !== undefined;
    const hasTags = data.conceptTags !== undefined;
    if (hasEval || hasTags) {
      const updateData: {
        evaluation?: import("@prisma/client").Prisma.InputJsonValue;
        conceptTags?: string[];
      } = {};
      if (hasEval) {
        updateData.evaluation = data.evaluation as unknown as import("@prisma/client").Prisma.InputJsonValue;
      }
      if (hasTags) {
        updateData.conceptTags = data.conceptTags ?? [];
      }
      if (submission.taskType === "simulation") {
        await tx.simulationSubmission.update({
          where: { submissionId },
          data: updateData,
        });
      } else if (submission.taskType === "quiz") {
        await tx.quizSubmission.update({
          where: { submissionId },
          data: updateData,
        });
      } else if (submission.taskType === "subjective") {
        await tx.subjectiveSubmission.update({
          where: { submissionId },
          data: updateData,
        });
      }
    }

    return submission;
  });
}

export async function deleteSubmission(submissionId: string) {
  return prisma.submission.delete({ where: { id: submissionId } });
}

export async function batchDeleteSubmissions(ids: string[], user: UserLike | string) {
  const actor =
    typeof user === "string"
      ? { id: user, role: "teacher" }
      : user;
  const uniqueIds = Array.from(new Set(ids));

  const submissions = await prisma.submission.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (submissions.length !== uniqueIds.length) {
    throw new Error("SUBMISSION_NOT_FOUND");
  }

  for (const id of uniqueIds) {
    await assertSubmissionReadable(id, actor);
  }

  return prisma.submission.deleteMany({ where: { id: { in: uniqueIds } } });
}
