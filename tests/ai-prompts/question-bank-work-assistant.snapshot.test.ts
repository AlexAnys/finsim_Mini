import { describe, it, expect } from "vitest";
import {
  buildQuestionBankPrompt,
  QUESTION_BANK_PROMPT_VERSION,
} from "@/lib/ai/prompts/question-bank";
import {
  buildWorkAssistantPrompt,
  WORK_ASSISTANT_PROMPT_VERSION,
} from "@/lib/ai/prompts/work-assistant";

describe("question-bank + work-assistant prompt builders (PR-1 E)", () => {
  it("question-bank import snapshot", () => {
    const r = buildQuestionBankPrompt({
      action: "import",
      courseName: "理财",
      courseDescription: "金融2024",
      chapterName: "复利",
      sectionName: "应用",
      teacherBrief: "侧重计算题",
      sources: [],
      questions: [],
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(QUESTION_BANK_PROMPT_VERSION);
  });

  it("question-bank checkOptimize snapshot", () => {
    const r = buildQuestionBankPrompt({
      action: "checkOptimize",
      courseName: "x",
      courseDescription: "",
      chapterName: "",
      sectionName: "",
      teacherBrief: "",
      sources: [],
      questions: [],
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
  });

  it("work-assistant lessonPolish snapshot", () => {
    const r = buildWorkAssistantPrompt({
      toolKey: "lessonPolish",
      materialText: "教案草稿",
      teacherRequest: "强调互动",
      outputStyle: "structured",
      strictness: "balanced",
      enableSearch: false,
      searchConfigured: false,
      fileReports: [],
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(WORK_ASSISTANT_PROMPT_VERSION);
  });

  it("work-assistant ideologyMining systemPrompt mentions task line", () => {
    const r = buildWorkAssistantPrompt({
      toolKey: "ideologyMining",
      materialText: "",
      teacherRequest: "",
      outputStyle: "structured",
      strictness: "balanced",
      enableSearch: false,
      searchConfigured: false,
      fileReports: [],
    });
    expect(r.systemPrompt).toContain("任务：课程思政挖掘");
  });

  it("work-assistant questionAnalysis system mentions task", () => {
    const r = buildWorkAssistantPrompt({
      toolKey: "questionAnalysis",
      materialText: "",
      teacherRequest: "",
      outputStyle: "structured",
      strictness: "balanced",
      enableSearch: true,
      searchConfigured: true,
      fileReports: [],
    });
    expect(r.systemPrompt).toContain("任务：搜题与解析");
    expect(r.userPrompt).toContain("允许使用已配置搜索 provider 的材料");
  });

  it("work-assistant examCheck system mentions task", () => {
    const r = buildWorkAssistantPrompt({
      toolKey: "examCheck",
      materialText: "",
      teacherRequest: "",
      outputStyle: "structured",
      strictness: "balanced",
      enableSearch: false,
      searchConfigured: false,
      fileReports: [],
    });
    expect(r.systemPrompt).toContain("任务：试卷检查");
  });
});
