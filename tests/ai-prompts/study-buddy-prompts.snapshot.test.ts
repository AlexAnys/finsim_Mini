import { describe, it, expect } from "vitest";
import {
  buildStudyBuddyReplyPrompt,
  SOCRATIC_MODE_PROMPT,
  DIRECT_MODE_PROMPT,
  STUDY_BUDDY_REPLY_PROMPT_VERSION,
} from "@/lib/ai/prompts/study-buddy-reply";
import {
  buildStudyBuddySummaryPrompt,
  STUDY_BUDDY_SUMMARY_PROMPT_VERSION,
} from "@/lib/ai/prompts/study-buddy-summary";

describe("study-buddy prompt builders (PR-1 E)", () => {
  it("reply socratic mode + no material snapshot", () => {
    const r = buildStudyBuddyReplyPrompt({
      modePrompt: SOCRATIC_MODE_PROMPT,
      fallbackInstructions: "这是任务相关提问。范围: 课程 / 章节。请围绕该任务或课程内容回答。",
      materialInstructions:
        "未引用具体素材：当前问题范围内未匹配到教师上传的素材。请基于课程概要 / 章节名 / 通用金融常识回答，并在回复开头明确标注\"未引用具体素材，以下基于通用知识\"。",
      hasMaterial: false,
      conversationHistory: "学生: 复利怎么算？",
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(STUDY_BUDDY_REPLY_PROMPT_VERSION);
  });

  it("reply direct mode + has material snapshot", () => {
    const r = buildStudyBuddyReplyPrompt({
      modePrompt: DIRECT_MODE_PROMPT,
      fallbackInstructions: "这是一个自由提问（不绑定具体任务）。请基于课程概要或通用金融常识回答。",
      materialInstructions:
        "优先使用下方教师补充课程素材；如素材不直接覆盖问题，再用通用金融知识补充并明确推断边界。",
      hasMaterial: true,
      materialContext: "素材 1（章节）: 复利原理...",
      taskContext: "任务背景: 模拟一次咨询。",
      taskName: "投资规划任务",
      conversationHistory: "学生: 复利如何应用？",
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
  });

  it("summary snapshot", () => {
    const r = buildStudyBuddySummaryPrompt({
      postCount: 3,
      questionsText: "什么是复利\n---\n如何分散投资\n---\n股票债券区别",
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(STUDY_BUDDY_SUMMARY_PROMPT_VERSION);
  });
});
