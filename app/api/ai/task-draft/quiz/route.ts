import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";
import {
  buildTaskDraftQuizPrompt,
  TASK_DRAFT_QUIZ_PROMPT_VERSION,
} from "@/lib/ai/prompts/task-draft-quiz";

const draftRequestSchema = z.object({
  courseName: z.string(),
  chapterName: z.string(),
  prompt: z.string().optional(),
});

const generatedQuestionSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]),
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
    correctOptionIds: z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
    points: z.number().min(1).max(3),
    difficulty: z.number().min(1).max(3),
    explanation: z.string(),
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

    const builtPrompt = buildTaskDraftQuizPrompt({
      courseName: parsed.data.courseName,
      chapterName: parsed.data.chapterName,
      prompt: parsed.data.prompt,
    });
    const generated = await aiGenerateJSON(
      "quizDraft",
      result.session.user.id,
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt,
      generatedQuestionSchema,
      2,
      { promptVersion: TASK_DRAFT_QUIZ_PROMPT_VERSION },
    );

    return success(generated);
  } catch (err) {
    return handleServiceError(err);
  }
}
