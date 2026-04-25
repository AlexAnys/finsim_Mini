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
  systemPrompt: z.string().optional(),
  /** PR-7B: caller (frontend) tracks the turn index of the last hint emitted.
   *  Service uses it to enforce "≥3 turns since last hint" for B3. */
  lastHintTurn: z.number().int().nonnegative().optional(),
  /** PR-7B: rubric criterion names used to grade student_perf + name deviated_dimensions */
  objectives: z.array(z.string()).max(20).optional(),
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

    const out = await chatReply(result.session.user.id, parsed.data);
    return success({
      reply: out.reply,
      mood: out.mood,
      hint: out.hint,
      hintTriggered: out.hintTriggered,
      studentPerf: out.studentPerf,
      deviatedDimensions: out.deviatedDimensions,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
