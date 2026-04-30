import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "./ai.service";
import { z } from "zod";
import { readFile } from "fs/promises";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";

const STORAGE_BASE = (process.env.FILE_STORAGE_PATH || "./public/uploads").replace(/\/+$/, "");

const parsedQuestionsSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]),
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
    correctOptionIds: z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
    points: z.number().min(1).max(5).default(1),
    explanation: z.string().optional(),
  })),
});

export async function createImportJob(data: {
  teacherId: string;
  taskId: string;
  fileName: string;
  filePath: string;
}) {
  const job = await prisma.importJob.create({
    data: {
      teacherId: data.teacherId,
      taskId: data.taskId,
      fileName: data.fileName,
      filePath: data.filePath,
      status: "uploaded",
    },
  });

  // Start async processing
  processImportJob(job.id, data.teacherId).catch(console.error);

  return job;
}

export async function getImportJob(jobId: string) {
  return prisma.importJob.findUnique({ where: { id: jobId } });
}

async function processImportJob(jobId: string, userId: string) {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "processing" },
  });

  try {
    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("JOB_NOT_FOUND");

    const fullPath = `${STORAGE_BASE}/${job.filePath}`;
    const buffer = await readFile(fullPath);
    const extracted = await extractDocumentText({
      buffer,
      fileName: job.fileName,
      allowOcr: true,
    });

    if (extracted.status !== "ready" || !extracted.text.trim()) {
      throw new Error(extracted.error || "无法从文件中提取文本内容");
    }

    // Truncate if too long
    const truncatedText = extracted.text.slice(0, 15000);

    // Use AI to extract questions
    const result = await aiGenerateJSON(
      "importParse",
      userId,
      `你是一位金融课程题目提取专家。请从以下文档文本中提取所有可以识别的题目，将它们结构化为标准格式。

规则：
1. 识别单选题、多选题、判断题、简答题
2. 选项 id 使用 A, B, C, D 等字母
3. 判断题选项为 [{"id":"T","text":"对"},{"id":"F","text":"错"}]
4. 如果无法确定正确答案，correctOptionIds 留空数组，correctAnswer 留空字符串
5. points 默认 1 分，根据题目复杂度可设为 1-5
6. 使用中文`,
      `以下是从文档中提取的文本：

${truncatedText}

请提取所有题目并返回 JSON:
{
  "questions": [
    {
      "type": "single_choice|multiple_choice|true_false|short_answer",
      "prompt": "题目内容",
      "options": [{"id": "A", "text": "选项"}],
      "correctOptionIds": ["A"],
      "correctAnswer": "简答参考答案",
      "points": 1,
      "explanation": "解析"
    }
  ]
}`,
      parsedQuestionsSchema
    );

    // Write questions to database
    const questions = result.questions;
    const existingCount = await prisma.quizQuestion.count({ where: { taskId: job.taskId } });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await prisma.quizQuestion.create({
        data: {
          taskId: job.taskId,
          type: q.type,
          prompt: q.prompt,
          options: q.options || [],
          correctOptionIds: q.correctOptionIds || [],
          correctAnswer: q.correctAnswer || null,
          points: q.points || 1,
          explanation: q.explanation || null,
          order: existingCount + i,
        },
      });
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        totalQuestions: questions.length,
        processedQuestions: questions.length,
      },
    });
  } catch (error) {
    console.error("Import job processing error:", error);
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "处理失败",
      },
    });
  }
}
