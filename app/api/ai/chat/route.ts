import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { chatReply } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError, forbidden } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { assertTaskInstanceReadable, assertTaskReadable } from "@/lib/auth/resource-access";
import { z } from "zod";

// PR-FIX-1 A9: 长度上限，防 prompt-injection / token 浪费 / context overflow
const MAX_TRANSCRIPT_ENTRIES = 50;
const MAX_TRANSCRIPT_TEXT_CHARS = 2000;
const MAX_SCENARIO_CHARS = 4000;
const MAX_SYSTEM_PROMPT_CHARS = 4000;
const MAX_OPENING_CHARS = 2000;
// PR-FIX-1 A9: 服务端最终只保留最近 N 轮（防被绕过）
const SERVER_TRIM_RECENT_TURNS = 30;
// PR-SIM-3 D3: 资产配置提交结构上限（防 token 浪费）
const MAX_ALLOCATION_SECTIONS = 10;
const MAX_ALLOCATION_ITEMS_PER_SECTION = 30;
const MAX_ALLOCATION_LABEL_CHARS = 80;

const chatSchema = z.object({
  taskId: z.string().uuid().optional(),
  taskInstanceId: z.string().uuid().optional(),
  transcript: z
    .array(
      z.object({
        role: z.string(),
        text: z.string().max(MAX_TRANSCRIPT_TEXT_CHARS, "单条消息超长"),
        // PR-FIX-2 B1: 服务端从 transcript 推导 lastHintTurn，需要可选 hint 字段
        hint: z.string().max(MAX_TRANSCRIPT_TEXT_CHARS).optional(),
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
   *  Service uses it to enforce "≥3 turns since last hint" for B3.
   *  PR-FIX-2 B1: 服务端会用 transcript 自行推导，客户端值仅作为校验参考，不可信赖。 */
  lastHintTurn: z.number().int().nonnegative().optional(),
  /** PR-7B: rubric criterion names used to grade student_perf + name deviated_dimensions */
  objectives: z.array(z.string()).max(20).optional(),
  /** PR-SIM-3 D3: 学生交互类型。默认 user_message（学生发文字）；
   *  config_submission 表示学生把当前资产配置交给客户征求反馈。 */
  messageType: z.enum(["user_message", "config_submission"]).optional(),
  /** PR-SIM-3 D3: 当 messageType=config_submission 时学生提交的资产配置快照。 */
  allocations: z
    .array(
      z.object({
        label: z.string().max(MAX_ALLOCATION_LABEL_CHARS, "section 标签超长"),
        items: z
          .array(
            z.object({
              label: z.string().max(MAX_ALLOCATION_LABEL_CHARS, "item 标签超长"),
              value: z.number().min(0).max(100),
            })
          )
          .max(MAX_ALLOCATION_ITEMS_PER_SECTION, "items 数量超长"),
      })
    )
    .max(MAX_ALLOCATION_SECTIONS, "sections 数量超长")
    .optional(),
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

    // PR-SIM-3 D3: messageType=config_submission 时必须带 allocations
    if (
      parsed.data.messageType === "config_submission" &&
      (!parsed.data.allocations || parsed.data.allocations.length === 0)
    ) {
      return validationError("提交配置时必须附带 allocations");
    }

    // PR-FIX-1 A9: 服务端最终只保留最近 N 轮（即使客户端绕过 max 限制 也能兜底）
    const trimmedTranscript = parsed.data.transcript.slice(
      -SERVER_TRIM_RECENT_TURNS
    );

    const settingsUserId = await resolveSettingsUserId({
      user: result.session.user,
      taskId: parsed.data.taskId,
      taskInstanceId: parsed.data.taskInstanceId,
    });

    const out = await chatReply(result.session.user.id, {
      ...parsed.data,
      transcript: trimmedTranscript,
    }, {
      settingsUserId,
      metadata: {
        taskId: parsed.data.taskId,
        taskInstanceId: parsed.data.taskInstanceId,
        settingsSource: settingsUserId === result.session.user.id ? "actor" : "teacher",
      },
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

async function resolveSettingsUserId(input: {
  user: { id: string; role: string; classId?: string | null };
  taskId?: string;
  taskInstanceId?: string;
}) {
  if (input.taskInstanceId) {
    await assertTaskInstanceReadable(input.taskInstanceId, input.user);
    const instance = await prisma.taskInstance.findUnique({
      where: { id: input.taskInstanceId },
      select: { taskId: true, createdBy: true },
    });
    if (!instance) throw new Error("INSTANCE_NOT_FOUND");
    if (input.taskId && instance.taskId !== input.taskId) throw new Error("FORBIDDEN");
    return instance.createdBy || input.user.id;
  }

  if (input.taskId) {
    await assertTaskReadable(input.taskId, input.user);
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { creatorId: true },
    });
    return task?.creatorId || input.user.id;
  }

  return input.user.id;
}
