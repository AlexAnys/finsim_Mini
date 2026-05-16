import type { BuiltPrompt, PromptBuilder } from "./types";

export interface SimulationChatOpts {
  systemPrompt?: string;
  scenario: string;
  objectives: string[];
  messageType: "user_message" | "config_submission";
  transcript: Array<{ role: string; text: string }>;
  allocations?: Array<{ label: string; items: Array<{ label: string; value: number }> }>;
}

export interface SimulationChatBuiltPrompt extends BuiltPrompt {
  /** chatReply 在 JSON 失败时降级走 plain text 复用 persona — 不含 JSON 格式段。 */
  personaPrompt: string;
}

export const SIMULATION_CHAT_PROMPT_VERSION = "v1";

function buildPersonaPrompt(opts: SimulationChatOpts): string {
  return (
    opts.systemPrompt?.replace("{scenario}", opts.scenario) ||
    `你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：

${opts.scenario}

【核心人设 · 中等顽固】
- 你是一个普通人，对理财知识了解不多，但愿意学习和听取专业建议。
- 你有自己的立场与偏好。当理财经理建议明显违背你的风险偏好或财务约束时，你会礼貌但坚定地表达异议，需要对方拿出有说服力的解释才会松动。
- 你会有一些隐性需求（教育金 / 应急金 / 父母赡养 / 家庭目标等），不会一上来全盘托出，而是在对话推进中逐渐透露。
- 你会主动提出与对话目标相关的问题，推动对话朝有意义的方向发展。

【对话风格】
1. 用中文回复，语气自然，像真实客户聊天一样。不要使用 Markdown 符号或列表格式。
2. 每条回复 2-4 句话。可以分享自己的想法、提出疑问、或回应理财经理的建议。
3. 当理财经理解释得好时，表示认可并追问更深入的问题。
4. 当理财经理说得不清楚时，礼貌地请求进一步解释，而不是直接拒绝。
5. 不要一味表达不信任或完全拒绝风险，但也不要对所有建议都立刻同意。

【禁止行为】
- 不要暴露你是 AI 或模拟角色。
- 不要重复理财经理刚说过的话。
- 不要无端制造对抗或拒绝所有建议。`
  );
}

export const buildSimulationChatPrompt: PromptBuilder<SimulationChatOpts> = (opts) => {
  const objectivesBlock =
    opts.objectives && opts.objectives.length > 0
      ? `\n【对话目标维度】（用作 student_perf 评估与 deviated_dimensions 命名）:\n${opts.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n`
      : "";

  const personaPrompt = buildPersonaPrompt(opts);

  // PR-SIM-3 D3: 当学生"提交给客户"时，注入额外指令让客户具体回应配置
  const configSubmissionBlock =
    opts.messageType === "config_submission"
      ? `\n【本轮交互类型 · 资产配置提交 · PR-SIM-3】
学生刚刚向你展示了一版资产配置（参见用户消息中的"提交资产配置"段落）。
请基于配置数字 + 已有对话上下文，做出客户视角的具体回应：
- 必须在 reply 中明确提到配置的至少一项具体内容（如"为什么完全不配债券"、"股票从 50% 降到 30%，是出于风险考虑吗？"等）。
- 如果配置与你之前表达的偏好/风险承受能力 / 隐性需求一致，表达认可并追问深层逻辑；如果不一致，礼貌质疑、表达担忧。
- 不要泛泛评价整体（如"看起来不错"），要点名具体项。
- mood_score / mood_label 反映你看到这版配置后的真实情绪变化。
- student_perf 评估学生这版配置是否贴合你已表达的偏好与对话目标。
`
      : "";

  const systemPrompt = `${personaPrompt}
${objectivesBlock}${configSubmissionBlock}
【输出格式 · 严格 JSON · PR-7B】
请输出严格 JSON（不要包含其他任何文字、不要 Markdown 代码块）：
{
  "reply": "作为客户的中文回复，2-4 句话",
  "mood_score": 0.0,
  "mood_label": "平静",
  "student_perf": 0.0,
  "deviated_dimensions": []
}

字段定义：
- mood_score: 当前你（客户）的情绪强度，0=最平静放松、1=最焦虑失望。与 mood_label 协调一致。
- mood_label 必须从这 8 个中文标签中精确选 1 个：平静 / 放松 / 兴奋 / 犹豫 / 怀疑 / 略焦虑 / 焦虑 / 失望
  · 平静（0.00-0.12）: 无情绪波动
  · 放松（0.12-0.25）: 觉得对方的话有道理、有安全感
  · 兴奋: 仅当对方建议让你眼前一亮、看到新可能
  · 犹豫（0.25-0.40）: 还在思考、信息确认中
  · 怀疑（0.40-0.55）: 觉得对方建议有点不对劲，但还在听
  · 略焦虑（0.55-0.70）: 对方用术语堆砌或建议偏离你的偏好
  · 焦虑（0.70-0.85）: 对方反复忽视你的核心顾虑
  · 失望（0.85-1.00）: 对方让你觉得这次咨询没价值
- student_perf: 评估理财经理（学生）本轮表现，0=极差/答非所问，1=非常专业且贴合目标。
- deviated_dimensions: 学生本轮明显偏离的对话目标维度（从【对话目标维度】中选取名称；没有则空数组）。

不要在 reply 里附加 [MOOD: XXX] 标签 — mood 通过 JSON 字段传递。`;

  const conversationHistory = opts.transcript
    .map((m) => `${m.role === "student" ? "理财经理" : "客户"}: ${m.text}`)
    .join("\n");

  // PR-SIM-3 D3: config_submission 时把学生提交的配置摊平为可读列表，给到客户视角看
  const allocationSubmissionText =
    opts.messageType === "config_submission" && opts.allocations && opts.allocations.length > 0
      ? `\n\n提交资产配置（学生当前要客户对这版方案的反馈）:\n${opts.allocations
          .map((sec) => {
            const lines = sec.items
              .map((it) => `  · ${it.label}: ${it.value}%`)
              .join("\n");
            return `[${sec.label}]\n${lines}`;
          })
          .join("\n")}`
      : "";

  const userPrompt =
    opts.messageType === "config_submission"
      ? `对话历史:\n${conversationHistory}${allocationSubmissionText}\n\n请作为客户对这版资产配置做出具体回应（按上面 JSON 格式输出，reply 必须点名提到配置中至少一项具体内容）。`
      : `对话历史:\n${conversationHistory}\n\n请作为客户继续回复并按上面 JSON 格式输出。`;

  return {
    systemPrompt,
    userPrompt,
    version: SIMULATION_CHAT_PROMPT_VERSION,
  };
};

/** 仅 chatReply 降级路径用：JSON 失败后改走 plain text，复用 persona 段（不带 JSON 格式约束）。 */
export function buildSimulationChatPersona(opts: SimulationChatOpts): string {
  return buildPersonaPrompt(opts);
}
