import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

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

    const generated = await aiGenerateJSON(
      "taskDraft",
      result.session.user.id,
      "你是一位资深的金融课程出题专家。请根据课程和章节信息生成高质量的测验题目。",
      `课程: ${parsed.data.courseName}
章节: ${parsed.data.chapterName}
${parsed.data.prompt ? `教师要求: ${parsed.data.prompt}` : ""}

请生成 10 道混合题型的测验题目（包含单选、多选、判断、简答），返回 JSON:
{
  "questions": [
    {
      "type": "single_choice|multiple_choice|true_false|short_answer",
      "prompt": "题目内容",
      "options": [{"id": "A", "text": "选项文本"}],
      "correctOptionIds": ["A"],
      "correctAnswer": "简答题参考答案",
      "points": 1-3,
      "difficulty": 1-3,
      "explanation": "解析"
    }
  ]
}

注意:
- 判断题的 options 为 [{"id":"T","text":"对"},{"id":"F","text":"错"}]
- 简答题不需要 options 和 correctOptionIds
- 每题 points 为 1-3 分
- 使用中文出题`,
      generatedQuestionSchema
    );

    return success(generated);
  } catch (err) {
    return handleServiceError(err);
  }
}
