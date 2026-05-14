import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "./ai.service";

/**
 * Unit 8 · QuizQuestion 知识点标签器
 *
 * 给指定 task 下的 QuizQuestion 调 AI 打 knowledgeTagIds（中文 conceptTag 字符串）。
 * 通常被 async-job 在任务首次创建/编辑后异步调用。
 *
 * 输入：taskId、teacher userId
 * 行为：
 *  - 只 tag 现状为空数组的 question（已有 tag 的不动）
 *  - 每题 prompt + options + correctAnswer 给 AI，返回 1-3 个 tag
 *  - 整任务一次 AI 调用（batch），避免 N 次 cost
 *  - 写入 QuizQuestion.knowledgeTagIds
 *
 * 返回 summary：{ tagged: N, skipped: M, failed: K }
 */

const tagSchema = z.object({
  taggings: z.array(
    z.object({
      questionId: z.string(),
      tags: z.array(z.string()).min(1).max(3),
    }),
  ),
});

export interface TagResult {
  tagged: number;
  skipped: number;
  failed: number;
  totalQuestions: number;
}

export async function tagQuizQuestions(
  taskId: string,
  userId: string,
): Promise<TagResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      quizQuestions: {
        orderBy: { order: "asc" },
      },
    },
  });
  if (!task) throw new Error("TASK_NOT_FOUND");
  if (task.taskType !== "quiz") throw new Error("TASK_NOT_QUIZ");

  const targetQuestions = task.quizQuestions.filter(
    (q) => q.knowledgeTagIds.length === 0,
  );
  if (targetQuestions.length === 0) {
    return {
      tagged: 0,
      skipped: task.quizQuestions.length,
      failed: 0,
      totalQuestions: task.quizQuestions.length,
    };
  }

  const systemPrompt = `你是一位资深的金融教育专家。为下列测验题目分别提取 1-3 个知识点标签（中文，统一用名词或短语，例如"复利""资产配置""风险偏好"）。
- 标签要尽量复用学科常见术语，避免凭空创造
- 同一标签可以在多道题之间复用
- 标签应该是该题考查的核心概念，不要太宽泛（不要"金融"这种顶层词）`;

  const questionsBlock = targetQuestions
    .map((q, i) => {
      const options = Array.isArray(q.options)
        ? q.options
            .map((o) => {
              const opt = o as { id?: string; label?: string; text?: string; content?: string };
              return `${opt.id ?? opt.label ?? ""}: ${opt.text ?? opt.content ?? ""}`;
            })
            .filter(Boolean)
            .join(" / ")
        : "";
      return `[${i + 1}] questionId=${q.id} 类型=${q.type} 题干=${q.prompt}${options ? ` 选项=${options}` : ""}${
        q.correctAnswer ? ` 参考答案=${q.correctAnswer.slice(0, 100)}` : ""
      }`;
    })
    .join("\n");

  const userPrompt = `共 ${targetQuestions.length} 道题需要打标：

${questionsBlock}

请按以下 JSON 格式输出（仅 JSON，无 Markdown）:
{
  "taggings": [
    {"questionId": "题目ID", "tags": ["标签1", "标签2"]}
  ]
}

要求：
- 每题 1-3 个 tags
- questionId 必须用上方提供的 ID
- 全部 ${targetQuestions.length} 题都要包含`;

  let result;
  try {
    result = await aiGenerateJSON(
      "questionAnalysis",
      userId,
      systemPrompt,
      userPrompt,
      tagSchema,
    );
  } catch (err) {
    console.error("[quiz-question-tagger] AI 调用失败：", err);
    throw new Error("QUIZ_TAGGING_FAILED");
  }

  // 写入 DB
  const byId = new Map(result.taggings.map((t) => [t.questionId, t.tags]));
  let tagged = 0;
  let failed = 0;
  for (const q of targetQuestions) {
    const tags = byId.get(q.id);
    if (!tags || tags.length === 0) {
      failed++;
      continue;
    }
    try {
      await prisma.quizQuestion.update({
        where: { id: q.id },
        data: { knowledgeTagIds: tags.slice(0, 3) },
      });
      tagged++;
    } catch (err) {
      console.error(`[quiz-question-tagger] 写入题目 ${q.id} 失败：`, err);
      failed++;
    }
  }

  return {
    tagged,
    skipped: task.quizQuestions.length - targetQuestions.length,
    failed,
    totalQuestions: task.quizQuestions.length,
  };
}

/** 检查 task 下 quiz 题目是否都已 tag，返回未 tag 题数 */
export async function getUntaggedCount(taskId: string): Promise<number> {
  const count = await prisma.quizQuestion.count({
    where: { taskId, knowledgeTagIds: { isEmpty: true } },
  });
  return count;
}
