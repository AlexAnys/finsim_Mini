import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";
import {
  buildTaskDraftSubjectivePrompt,
  TASK_DRAFT_SUBJECTIVE_PROMPT_VERSION,
} from "@/lib/ai/prompts/task-draft-subjective";

const draftRequestSchema = z.object({
  courseName: z.string(),
  chapterName: z.string(),
  prompt: z.string().optional(),
});

const generatedSubjectiveSchema = z.object({
  taskName: z.string(),
  requirements: z.string(),
  prompt: z.string(),
  referenceAnswer: z.string(),
  scoringCriteria: z.array(z.object({
    name: z.string(),
    description: z.string(),
    maxPoints: z.number(),
  })),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = draftRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const builtPrompt = buildTaskDraftSubjectivePrompt({
      courseName: parsed.data.courseName,
      chapterName: parsed.data.chapterName,
      prompt: parsed.data.prompt,
    });
    const generated = await aiGenerateJSON(
      "subjectiveDraft",
      result.session.user.id,
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt,
      generatedSubjectiveSchema,
      2,
      { promptVersion: TASK_DRAFT_SUBJECTIVE_PROMPT_VERSION },
    );

    return success(generated);
  } catch (err) {
    return handleServiceError(err);
  }
}
