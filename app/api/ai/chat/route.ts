import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { chatReply, chatReplyStream } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
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
  // role 限定 enum 防 transcript 注入：之前 z.string() 允许学生伪造任意 role
  // (例如 "customer" / "ai")，被 ai.service.ts:723 的 m.role==="student"?... 三元
  // 化为"客户"喂回 prompt，等于学生可以塞自己想让 AI 客户说过的话。
  transcript: z
    .array(
      z.object({
        role: z.enum(["student", "ai"]),
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

    // PR-SIM-3 D3: messageType=config_submission 时必须带 allocations
    if (
      parsed.data.messageType === "config_submission" &&
      (!parsed.data.allocations || parsed.data.allocations.length === 0)
    ) {
      return validationError("提交配置时必须附带 allocations");
    }

    // 不在此处做 transcript 角色顺序校验：
    // (1) runner 初始化把 openingLine 作为 role="ai" 放进 messages[0]，所以学生
    //     第一次发送时 transcript 必然是 [ai, student]，"必须从 student 开始" 这种
    //     检查会把每个 simulation 的第一条消息全拒掉；
    // (2) AI 调用失败时学生消息保留 + 重发，会形成 [ai, student, student] 这类
    //     合法重试模式，结构层面无法稳定区分 "失败重试" 与 "伪造连发"；
    // (3) role enum 已限制为 ["student","ai"]，能拦下手写 "customer"/"system" 等
    //     乱写的字符串；但学生用 role="ai" 伪造 customer 历史（codex P0#1 描述的
    //     真实攻击路径）光靠结构校验拦不住，需要服务端可信 turn log（migration
    //     工作量较大，下一迭代专项做）。

    // PR-FIX-1 A9: 服务端最终只保留最近 N 轮（即使客户端绕过 max 限制 也能兜底）
    const trimmedTranscript = parsed.data.transcript.slice(
      -SERVER_TRIM_RECENT_TURNS
    );

    // 学生身份的 systemPrompt 处理：原 PR-FIX-1 UX4 在学生传 systemPrompt 时返回 403，
    // 但 SimulationRunner 始终透传从 task config 读到的 systemPrompt（见 sim/[id]/page.tsx
    // 的 systemPrompt={simConfig.systemPrompt || undefined}），导致教师只要在
    // SimulationConfig 设了自定义 systemPrompt，所有学生发送对话都立即 403、整个
    // simulation 任务对学生不可用。
    //
    // 修复：服务端从 task config 读权威 systemPrompt，**忽略学生客户端传入值**
    // （仍然防 prompt-injection），教师/admin 在 preview 时仍允许传客户端值
    // （任务向导预览自定义 prompt 的功能保留）。
    const trustedSystemPrompt = await resolveSystemPrompt({
      user: result.session.user,
      clientValue: parsed.data.systemPrompt,
      taskId: parsed.data.taskId,
      taskInstanceId: parsed.data.taskInstanceId,
    });

    const settingsUserId = await resolveSettingsUserId({
      user: result.session.user,
      taskId: parsed.data.taskId,
      taskInstanceId: parsed.data.taskInstanceId,
    });

    const chatInput = {
      ...parsed.data,
      transcript: trimmedTranscript,
      systemPrompt: trustedSystemPrompt,
    };
    const callerOptions = {
      settingsUserId,
      metadata: {
        taskId: parsed.data.taskId,
        taskInstanceId: parsed.data.taskInstanceId,
        settingsSource: settingsUserId === result.session.user.id ? "actor" : "teacher",
      },
    };

    // Fix 3 · 客户端按 Accept: text/event-stream 走流式 SSE 通道；
    // 旧 JSON 路径保留为默认（向后兼容 e2e / curl / 任意非浏览器调用）。
    const wantsStream = request.headers.get("accept")?.includes("text/event-stream") ?? false;
    if (wantsStream) {
      return streamChatResponse(result.session.user.id, chatInput, callerOptions);
    }

    const out = await chatReply(result.session.user.id, chatInput, callerOptions);
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

/**
 * Fix 3 · SSE 包装。事件协议（前端 simulation-runner 同步实现）：
 *   event: chunk      data: {"delta":"..."}          // reply 文本增量
 *   event: meta       data: {"reply":..,"mood":..}   // 最终 metadata（mood/hint/studentPerf）
 *   event: error      data: {"code":"...","message":"..."}  // 上游或超时错误
 *   event: done       data: {}                        // 收尾
 *
 * 不直接抛 throw，避免破坏 SSE 协议；任何失败都会从 SSE 通道里写 `error` 事件 + 中文消息。
 */
function streamChatResponse(
  userId: string,
  data: Parameters<typeof chatReplyStream>[1],
  options: Parameters<typeof chatReplyStream>[2],
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: string, payload: unknown) {
        const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(body));
      }
      try {
        const { replyStream, meta } = await chatReplyStream(userId, data, options);
        for await (const delta of replyStream) {
          send("chunk", { delta });
        }
        const metadata = await meta();
        send("meta", {
          reply: metadata.reply,
          mood: metadata.mood,
          hint: metadata.hint,
          hintTriggered: metadata.hintTriggered,
          studentPerf: metadata.studentPerf,
          deviatedDimensions: metadata.deviatedDimensions,
          degraded: metadata.degraded,
        });
        send("done", {});
      } catch (err) {
        const aborted =
          err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message));
        if (aborted) {
          send("error", { code: "AI_TIMEOUT", message: "AI 回复超时，请稍后再试" });
        } else if (err instanceof Error && err.message === "RATE_LIMIT_EXCEEDED") {
          send("error", { code: "RATE_LIMIT", message: "请求频率超限，请稍后再试" });
        } else if (err instanceof Error && err.message.startsWith("AI_PROVIDER_NOT_CONFIGURED")) {
          send("error", { code: "AI_NOT_CONFIGURED", message: "AI 服务未配置" });
        } else {
          send("error", {
            code: "AI_PROVIDER_ERROR",
            message: "AI 服务暂时不可用，请稍后重试",
          });
        }
        send("done", {});
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no", // nginx 默认 buffer SSE，得显式关掉
      Connection: "keep-alive",
    },
  });
}

/**
 * 决定本次 chat 用哪个 systemPrompt：
 * - 学生：忽略客户端传入值，从 SimulationConfig 拉服务端权威值（防 prompt-injection）
 * - 教师/admin：客户端值优先（用于任务向导 preview 测试新 prompt），无客户端值时
 *   也回落到服务端值（保持行为一致）
 */
async function resolveSystemPrompt(input: {
  user: { id: string; role: string };
  clientValue?: string;
  taskId?: string;
  taskInstanceId?: string;
}): Promise<string | undefined> {
  const isStudent = input.user.role === "student";

  if (!isStudent && input.clientValue !== undefined) {
    return input.clientValue;
  }

  // 服务端拉 task simulationConfig.systemPrompt
  if (input.taskInstanceId) {
    const instance = await prisma.taskInstance.findUnique({
      where: { id: input.taskInstanceId },
      select: { task: { select: { simulationConfig: { select: { systemPrompt: true } } } } },
    });
    return instance?.task?.simulationConfig?.systemPrompt ?? undefined;
  }
  if (input.taskId) {
    const config = await prisma.simulationConfig.findUnique({
      where: { taskId: input.taskId },
      select: { systemPrompt: true },
    });
    return config?.systemPrompt ?? undefined;
  }

  return undefined;
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
