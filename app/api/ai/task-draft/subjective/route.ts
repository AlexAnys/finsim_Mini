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

    const generated = await aiGenerateJSON(
      "taskDraft",
      result.session.user.id,
      "你是一位资深的金融课程出题专家。请根据课程信息生成高质量的主观题任务。",
      `课程: ${parsed.data.courseName}
章节: ${parsed.data.chapterName}
${parsed.data.prompt ? `教师要求: ${parsed.data.prompt}` : ""}

请生成一道主观题任务，返回 JSON:
{
  "taskName": "任务名称",
  "requirements": "任务要求描述",
  "prompt": "给学生看的题目/提示语",
  "referenceAnswer": "参考答案",
  "scoringCriteria": [
    {"name": "评分标准名称", "description": "评分标准描述", "maxPoints": 分值}
  ]
}

注意: 评分标准应该包含 3-5 项，总分 100 分，使用中文。`,
      generatedSubjectiveSchema
    );

    return success(generated);
  } catch (err) {
    return handleServiceError(err);
  }
}
