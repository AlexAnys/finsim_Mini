import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertSubmissionReadable } from "@/lib/auth/resource-access";
import { updateSubmissionGrade } from "@/lib/services/submission.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const manualGradeSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(0),
  feedback: z.string().optional(),
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

    const updated = await updateSubmissionGrade(id, {
      status: "graded",
      score: parsed.data.score,
      maxScore: parsed.data.maxScore,
    });
    return success(updated);
  } catch (err) {
    return handleServiceError(err);
  }
}
