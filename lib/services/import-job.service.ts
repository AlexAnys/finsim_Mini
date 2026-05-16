import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "./ai.service";
import { z } from "zod";
import { readFile } from "fs/promises";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";
import {
  buildImportParsePrompt,
  IMPORT_PARSE_PROMPT_VERSION,
} from "@/lib/ai/prompts/import-parse";

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
    const builtPrompt = buildImportParsePrompt({ truncatedText });
    const result = await aiGenerateJSON(
      "importParse",
      userId,
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt,
      parsedQuestionsSchema,
      2,
      { promptVersion: IMPORT_PARSE_PROMPT_VERSION },
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
