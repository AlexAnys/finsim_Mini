import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { assertTaskInstanceReadable } from "@/lib/auth/resource-access";
import { nextQuizQuestion } from "@/lib/services/quiz-attempt.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
const schema = z.object({ taskInstanceId: z.string().uuid(), attemptId: z.string().uuid().optional() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationError("请求参数不正确");
    await assertTaskInstanceReadable(parsed.data.taskInstanceId, auth.session.user);
    return success(await nextQuizQuestion((await params).id, parsed.data.taskInstanceId, auth.session.user.id, parsed.data.attemptId));
  } catch (err) { return handleServiceError(err); }
}
