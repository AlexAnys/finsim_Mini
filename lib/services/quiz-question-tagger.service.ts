import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "./ai.service";
import {
  buildQuizQuestionTaggerPrompt,
  QUIZ_QUESTION_TAGGER_PROMPT_VERSION,
} from "@/lib/ai/prompts/quiz-question-tagger";

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

  const builtPrompt = buildQuizQuestionTaggerPrompt({
    questionsBlock,
    total: targetQuestions.length,
  });

  let result;
  try {
    result = await aiGenerateJSON(
      "questionAnalysis",
      userId,
      builtPrompt.systemPrompt,
      builtPrompt.userPrompt,
      tagSchema,
      2,
      { promptVersion: QUIZ_QUESTION_TAGGER_PROMPT_VERSION },
    );
  } catch (err) {
    console.error("[quiz-question-tagger] AI 调用失败：", err);
    throw new Error("QUIZ_TAGGING_FAILED");
  }

  // 写入 DB
  // Phase3-A · Defense 3: byId 主匹配 UUID；byIdx fallback 兜底 AI 用 prompt 索引（"[1]"、"1"）
  // 替代 questionId 的情况。tagged 计数仅在 prisma.update 成功后递增，确保 result 与 DB 状态一致。
  const byId = new Map(result.taggings.map((t) => [t.questionId, t.tags]));
  // byIdx 总是用 array position 建索引（idx+1）；与 byId 的 questionId 主键并存。
  // 查找顺序：byId.get(q.id) 优先（真 UUID）→ byIdx.get("N"|"[N]") 兜底（AI 用 index 替代 UUID 时）。
  const byIdx = new Map<string, string[]>();
  result.taggings.forEach((t, idx) => {
    byIdx.set(`${idx + 1}`, t.tags);
    byIdx.set(`[${idx + 1}]`, t.tags);
  });

  let tagged = 0;
  let failed = 0;
  for (let i = 0; i < targetQuestions.length; i++) {
    const q = targetQuestions[i];
    const primary = byId.get(q.id);
    const fallbackIdx = byIdx.get(`${i + 1}`) ?? byIdx.get(`[${i + 1}]`);
    const tags = primary && primary.length > 0 ? primary : fallbackIdx;
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
