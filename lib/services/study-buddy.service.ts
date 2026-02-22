import { prisma } from "@/lib/db/prisma";
import * as aiService from "./ai.service";
import { z } from "zod";

export async function createPost(data: {
  studentId: string;
  taskId: string;
  taskInstanceId?: string;
  title: string;
  question: string;
  mode: "socratic" | "direct";
  anonymous: boolean;
}) {
  // 获取任务的学习伙伴上下文
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    include: { simulationConfig: true },
  });

  const post = await prisma.studyBuddyPost.create({
    data: {
      studentId: data.studentId,
      taskId: data.taskId,
      taskInstanceId: data.taskInstanceId,
      title: data.title,
      question: data.question,
      mode: data.mode,
      anonymous: data.anonymous,
      messages: [{ role: "student", content: data.question, createdAt: new Date().toISOString() }],
    },
  });

  // 异步生成 AI 回复
  generateReply(post.id, data.studentId, task).catch(console.error);

  return post;
}

async function generateReply(
  postId: string,
  userId: string,
  task: { taskName: string; simulationConfig?: { studyBuddyContext?: string | null } | null } | null
) {
  const post = await prisma.studyBuddyPost.findUnique({ where: { id: postId } });
  if (!post) return;

  const messages = (post.messages as Array<{ role: string; content: string }>) || [];
  const modePrompt = post.mode === "socratic"
    ? "使用苏格拉底式教学法。通过提问引导学生思考，不直接给出答案。"
    : "以清晰、分步骤的方式直接回答学生的问题。";

  const context = task?.simulationConfig?.studyBuddyContext || "";

  try {
    const reply = await aiService.aiGenerateText(
      "studyBuddyReply",
      userId,
      `你是一位耐心的金融课程学习辅导助手。
${modePrompt}
${context ? `背景资料:\n${context}` : ""}
任务: ${task?.taskName || ""}`,
      `对话历史:\n${messages.map((m) => `${m.role === "student" ? "学生" : "助手"}: ${m.content}`).join("\n")}\n\n请回复：`
    );

    const updatedMessages = [
      ...messages,
      { role: "ai", content: reply, createdAt: new Date().toISOString() },
    ];

    await prisma.studyBuddyPost.update({
      where: { id: postId },
      data: {
        aiReply: reply,
        replyGeneratedAt: new Date(),
        status: "answered",
        messages: updatedMessages,
      },
    });
  } catch (error) {
    await prisma.studyBuddyPost.update({
      where: { id: postId },
      data: { status: "error" },
    });
    console.error("学习伙伴回复失败:", error);
  }
}

export async function continueConversation(postId: string, userId: string, content: string) {
  const post = await prisma.studyBuddyPost.findUnique({
    where: { id: postId },
    include: { task: { include: { simulationConfig: true } } },
  });

  if (!post || post.studentId !== userId) {
    throw new Error("FORBIDDEN");
  }

  const messages = (post.messages as Array<{ role: string; content: string; createdAt: string }>) || [];
  messages.push({ role: "student", content, createdAt: new Date().toISOString() });

  await prisma.studyBuddyPost.update({
    where: { id: postId },
    data: { messages, status: "pending" },
  });

  // 异步生成回复
  generateReply(postId, userId, post.task).catch(console.error);

  return { success: true };
}

export async function generateSummary(taskId: string, userId: string) {
  const posts = await prisma.studyBuddyPost.findMany({
    where: { taskId, status: "answered" },
    select: { question: true, aiReply: true, messages: true },
    take: 100,
  });

  if (posts.length === 0) {
    throw new Error("NO_POSTS_TO_SUMMARIZE");
  }

  const summarySchema = z.object({
    topQuestions: z.array(z.object({
      question: z.string(),
      count: z.number(),
      examples: z.array(z.string()),
    })),
    knowledgeGaps: z.array(z.object({
      topic: z.string(),
      description: z.string(),
      frequency: z.number(),
    })),
  });

  const questionsText = posts.map((p) => p.question).join("\n---\n");

  const result = await aiService.aiGenerateJSON(
    "studyBuddySummary",
    userId,
    "你是一位教育数据分析专家。请分析学生们在学习伙伴中提出的问题，找出高频问题和知识盲区。",
    `以下是 ${posts.length} 个学生提问:\n\n${questionsText}\n\n请返回 JSON:
{
  "topQuestions": [{"question": "高频问题", "count": 出现次数, "examples": ["原始问题示例"]}],
  "knowledgeGaps": [{"topic": "知识盲区主题", "description": "描述", "frequency": 出现频率}]
}`,
    summarySchema
  );

  return prisma.studyBuddySummary.create({
    data: {
      taskId,
      generatedAt: new Date(),
      topQuestions: result.topQuestions,
      knowledgeGaps: result.knowledgeGaps,
    },
  });
}
