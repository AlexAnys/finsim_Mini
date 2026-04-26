import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { chatReply } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError, forbidden } from "@/lib/api-utils";
import { z } from "zod";

// PR-FIX-1 A9: 长度上限，防 prompt-injection / token 浪费 / context overflow
const MAX_TRANSCRIPT_ENTRIES = 50;
const MAX_TRANSCRIPT_TEXT_CHARS = 2000;
const MAX_SCENARIO_CHARS = 4000;
const MAX_SYSTEM_PROMPT_CHARS = 4000;
const MAX_OPENING_CHARS = 2000;
// PR-FIX-1 A9: 服务端最终只保留最近 N 轮（防被绕过）
const SERVER_TRIM_RECENT_TURNS = 30;

const chatSchema = z.object({
  transcript: z
    .array(
      z.object({
        role: z.string(),
        text: z.string().max(MAX_TRANSCRIPT_TEXT_CHARS, "单条消息超长"),
      })
    )
    .max(MAX_TRANSCRIPT_ENTRIES, "对话历史超长"),
  scenario: z.string().max(MAX_SCENARIO_CHARS, "场景描述超长"),
  openingLine: z.string().max(MAX_OPENING_CHARS).optional(),
  systemPrompt: z
    .string()
    .max(MAX_SYSTEM_PROMPT_CHARS, "系统提示超长")
    .optional(),
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

    // PR-FIX-1 UX4: 学生 role 不允许传 systemPrompt（防 prompt-injection 绕过 AI 客户人设）
    // 教师 / admin 可传（用于任务向导预览模拟对话功能）
    if (
      parsed.data.systemPrompt !== undefined &&
      result.session.user.role === "student"
    ) {
      return forbidden("学生不允许传入自定义系统提示");
    }

    // PR-FIX-1 A9: 服务端最终只保留最近 N 轮（即使客户端绕过 max 限制 也能兜底）
    const trimmedTranscript = parsed.data.transcript.slice(
      -SERVER_TRIM_RECENT_TURNS
    );

    const out = await chatReply(result.session.user.id, {
      ...parsed.data,
      transcript: trimmedTranscript,
    });
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
