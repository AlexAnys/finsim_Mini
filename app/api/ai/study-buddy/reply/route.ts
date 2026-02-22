import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { continueConversation } from "@/lib/services/study-buddy.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const replySchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const data = await continueConversation(
      parsed.data.postId,
      result.session.user.id,
      parsed.data.content
    );
    return success(data);
  } catch (err) {
    return handleServiceError(err);
  }
}
