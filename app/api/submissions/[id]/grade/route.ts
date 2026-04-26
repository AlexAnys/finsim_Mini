import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import {
  getSubmissionById,
  updateSubmissionGrade,
} from "@/lib/services/submission.service";
import { logAuditForced } from "@/lib/services/audit.service";
import { rubricBreakdownSchema } from "@/lib/validators/submission.schema";
import { success, validationError, handleServiceError, notFound } from "@/lib/api-utils";
import { z } from "zod";

// PR-FIX-3 C1: 加 feedback + rubricBreakdown 让手工批改持久化分维度评语
const manualGradeSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(0),
  feedback: z.string().optional(),
  rubricBreakdown: z.array(rubricBreakdownSchema).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertSubmissionReadable(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });

    const body = await request.json();
    const parsed = manualGradeSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    // PR-FIX-3 C1: 当 feedback / rubricBreakdown 提供时 merge 到现有 evaluation
    // （AI 已批改后教师手工修订场景：保留 conceptTags / 其他字段）
    let mergedEvaluation: Record<string, unknown> | undefined;
    if (
      parsed.data.feedback !== undefined ||
      parsed.data.rubricBreakdown !== undefined
    ) {
      const existing = await getSubmissionById(id);
      if (!existing) return notFound("提交不存在");
      const subDetail =
        existing.simulationSubmission ??
        existing.quizSubmission ??
        existing.subjectiveSubmission ??
        null;
      const prior = (subDetail?.evaluation as Record<string, unknown> | null) ?? {};
      mergedEvaluation = {
        ...prior,
        totalScore: parsed.data.score,
        maxScore: parsed.data.maxScore,
        ...(parsed.data.feedback !== undefined && { feedback: parsed.data.feedback }),
        ...(parsed.data.rubricBreakdown !== undefined && {
          rubricBreakdown: parsed.data.rubricBreakdown,
        }),
      };
    }

    const updated = await updateSubmissionGrade(id, {
      status: "graded",
      score: parsed.data.score,
      maxScore: parsed.data.maxScore,
      ...(mergedEvaluation !== undefined && { evaluation: mergedEvaluation }),
    });
    // PR-FIX-1 UX5: 手工批改强制 audit（合规追责）
    await logAuditForced({
      action: "submission.grade",
      actorId: user.id,
      targetId: id,
      targetType: "submission",
      metadata: {
        score: parsed.data.score,
        maxScore: parsed.data.maxScore,
        // PR-FIX-3 C1: 记录是否带分维度评语 / 总评（合规追责）
        hasFeedback: parsed.data.feedback !== undefined,
        hasRubricBreakdown: parsed.data.rubricBreakdown !== undefined,
      },
    });
    return success(updated);
  } catch (err) {
    return handleServiceError(err);
  }
}
