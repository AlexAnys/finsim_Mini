import type { PromptBuilder } from "./types";

export interface StudyBuddyReplyOpts {
  modePrompt: string;
  fallbackInstructions: string;
  materialInstructions: string;
  taskContext?: string;
  materialContext?: string;
  taskName?: string;
  hasMaterial: boolean;
  /** 对话历史拼成的"学生: ... / 助手: ..."字符串 */
  conversationHistory: string;
}

export const STUDY_BUDDY_REPLY_PROMPT_VERSION = "v1";

export const buildStudyBuddyReplyPrompt: PromptBuilder<StudyBuddyReplyOpts> = (opts) => {
  const systemPrompt = `你是一位耐心的金融课程学习辅导助手。
${opts.modePrompt}
${opts.fallbackInstructions}
${opts.taskContext ? `任务背景资料:\n${opts.taskContext}` : ""}
${opts.hasMaterial ? `教师补充课程素材:\n${opts.materialContext}` : ""}
${opts.taskName ? `任务: ${opts.taskName}` : ""}

规则：
1. 不要使用 Markdown 符号（如 **、#、-、*），如需列点请每条独立换行并用数字编号（如 1. 2. 3.）。
2. 注意上下文连贯，回答追问时参考之前的对话内容。
3. ${opts.materialInstructions}
4. 绝不拒答 — 任何金融教学相关问题都应给出有教育价值的回答；只在问题完全偏离学习范畴时温和引导回到学习主题。
5. 围绕课程内容展开，不要发散到无关话题。`;

  const userPrompt = `对话历史:\n${opts.conversationHistory}\n\n请回复：`;

  return {
    systemPrompt,
    userPrompt,
    version: STUDY_BUDDY_REPLY_PROMPT_VERSION,
  };
};

/** 两种模式的引导语 — service 层既可调 helper 也可直接传字面 modePrompt。 */
export const SOCRATIC_MODE_PROMPT =
  "使用苏格拉底式教学法：不直接给出答案，而是每次提 1-2 个引导性问题帮助学生自己发现答案。先肯定学生思考中正确的部分，再通过提问引导其完善。";
export const DIRECT_MODE_PROMPT = "以清晰、分步骤的方式直接回答学生的问题。";
