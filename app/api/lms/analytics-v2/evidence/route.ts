import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import {
  assertTaskInstanceReadableTeacherOnly,
  assertTaskReadable,
} from "@/lib/auth/resource-access";
import { handleServiceError, notFound, success, validationError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submissionId")?.trim();
  if (!submissionId) return validationError("submissionId is required");

  try {
    const { user } = auth.session;
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        task: {
          select: {
            id: true,
            taskName: true,
            taskType: true,
            scoringCriteria: { orderBy: { order: "asc" } },
            quizQuestions: { orderBy: { order: "asc" } },
          },
        },
        taskInstance: {
          select: {
            id: true,
            title: true,
            taskType: true,
            class: { select: { id: true, name: true } },
            course: { select: { id: true, courseTitle: true } },
            chapter: { select: { id: true, title: true } },
            section: { select: { id: true, title: true } },
          },
        },
        simulationSubmission: true,
        quizSubmission: true,
        subjectiveSubmission: { include: { attachments: true } },
      },
    });
    if (!submission) return notFound("提交不存在");

    if (submission.taskInstanceId) {
      await assertTaskInstanceReadableTeacherOnly(submission.taskInstanceId, {
        id: user.id,
        role: user.role,
        classId: user.classId,
      });
    } else {
      await assertTaskReadable(submission.taskId, {
        id: user.id,
        role: user.role,
        classId: user.classId,
      });
    }

    return success({
      id: submission.id,
      taskType: submission.taskType,
      status: submission.status,
      score: submission.score !== null ? Number(submission.score) : null,
      maxScore: submission.maxScore !== null ? Number(submission.maxScore) : null,
      submittedAt: submission.submittedAt,
      gradedAt: submission.gradedAt,
      releasedAt: submission.releasedAt,
      student: submission.student,
      task: submission.task,
      taskInstance: submission.taskInstance,
      simulation: submission.simulationSubmission
        ? {
            transcript: submission.simulationSubmission.transcript,
            evaluation: submission.simulationSubmission.evaluation,
            conceptTags: submission.simulationSubmission.conceptTags,
          }
        : null,
      quiz: submission.quizSubmission
        ? {
            answers: submission.quizSubmission.answers,
            evaluation: submission.quizSubmission.evaluation,
            conceptTags: submission.quizSubmission.conceptTags,
            questions: submission.task.quizQuestions,
          }
        : null,
      subjective: submission.subjectiveSubmission
        ? {
            textAnswer: submission.subjectiveSubmission.textAnswer,
            extractedText: submission.subjectiveSubmission.extractedText,
            evaluation: submission.subjectiveSubmission.evaluation,
            conceptTags: submission.subjectiveSubmission.conceptTags,
            attachments: submission.subjectiveSubmission.attachments.map((attachment) => ({
              id: attachment.id,
              fileName: attachment.fileName,
              fileSize: attachment.fileSize,
              contentType: attachment.contentType,
            })),
          }
        : null,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
