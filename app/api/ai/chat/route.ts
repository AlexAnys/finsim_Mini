import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { chatReply } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const chatSchema = z.object({
  transcript: z.array(z.object({
    role: z.string(),
    text: z.string(),
  })),
  scenario: z.string(),
  openingLine: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const reply = await chatReply(result.session.user.id, parsed.data);
    return success({ reply });
  } catch (err) {
    return handleServiceError(err);
  }
}
