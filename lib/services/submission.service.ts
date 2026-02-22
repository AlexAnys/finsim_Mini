import { prisma } from "@/lib/db/prisma";
import type { CreateSubmissionInput } from "@/lib/validators/submission.schema";

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
          evaluation: input.evaluation ?? undefined,
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
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
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
      },
    });

    // 更新类型专属记录的 evaluation
    if (data.evaluation) {
      const evaluation = data.evaluation as unknown as import("@prisma/client").Prisma.InputJsonValue;
      if (submission.taskType === "simulation") {
        await tx.simulationSubmission.update({
          where: { submissionId },
          data: { evaluation },
        });
      } else if (submission.taskType === "quiz") {
        await tx.quizSubmission.update({
          where: { submissionId },
          data: { evaluation },
        });
      } else if (submission.taskType === "subjective") {
        await tx.subjectiveSubmission.update({
          where: { submissionId },
          data: { evaluation },
        });
      }
    }

    return submission;
  });
}

export async function deleteSubmission(submissionId: string) {
  return prisma.submission.delete({ where: { id: submissionId } });
}

export async function batchDeleteSubmissions(ids: string[], teacherId: string) {
  // 验证所有提交归属于该教师的任务
  const submissions = await prisma.submission.findMany({
    where: { id: { in: ids } },
    include: { task: { select: { creatorId: true } } },
  });

  for (const sub of submissions) {
    if (sub.task.creatorId !== teacherId) {
      throw new Error("FORBIDDEN");
    }
  }

  return prisma.submission.deleteMany({ where: { id: { in: ids } } });
}
