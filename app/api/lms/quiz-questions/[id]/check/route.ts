import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { assertTaskInstanceReadable } from "@/lib/auth/resource-access";
import { checkQuizAttemptAnswer } from "@/lib/services/quiz-attempt.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
const schema = z.object({ taskInstanceId: z.string().uuid(), attemptId: z.string().uuid(), selectedOptionIds: z.array(z.string().max(120)).max(20).optional(), textAnswer: z.string().max(2000).optional() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationError("请求参数不正确");
    await assertTaskInstanceReadable(parsed.data.taskInstanceId, auth.session.user);
    return success(await checkQuizAttemptAnswer(parsed.data.attemptId, parsed.data.taskInstanceId, auth.session.user.id, (await params).id, parsed.data));
  } catch (err) { return handleServiceError(err); }
}
