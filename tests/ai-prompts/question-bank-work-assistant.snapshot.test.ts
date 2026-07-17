import { describe, it, expect } from "vitest";
import {
  buildQuestionBankPrompt,
  QUESTION_BANK_PROMPT_VERSION,
} from "@/lib/ai/prompts/question-bank";
import {
  buildWorkAssistantPrompt,
  WORK_ASSISTANT_PROMPT_VERSION,
  type WorkAssistantToolKey,
} from "@/lib/ai/prompts/work-assistant";

const WORK_ASSISTANT_BASE = {
  materialText: "测试材料",
  teacherRequest: "",
  outputStyle: "structured",
  strictness: "balanced",
  fileReports: [],
};

function buildWorkAssistant(toolKey: WorkAssistantToolKey, extraFields: Record<string, string> = {}) {
  return buildWorkAssistantPrompt({
    ...WORK_ASSISTANT_BASE,
    toolKey,
    extraFields,
  });
}

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
      fileReports: [],
      extraFields: {},
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(WORK_ASSISTANT_PROMPT_VERSION);
  });

  it("work-assistant ideologyMining systemPrompt mentions task line", () => {
    const r = buildWorkAssistant("ideologyMining");
    expect(r.systemPrompt).toContain("任务：课程思政挖掘");
  });

  it("work-assistant questionAnalysis 正名为题目解析且不再承诺搜索", () => {
    const r = buildWorkAssistant("questionAnalysis");
    expect(r.systemPrompt).toContain("任务：题目解析");
    expect(r.systemPrompt).not.toContain("搜题与解析");
    expect(r.userPrompt).not.toContain("搜索请求");
    expect(r.userPrompt).not.toContain("搜索 provider");
    expect(r.userPrompt).not.toContain("允许使用已配置搜索");
  });

  it("work-assistant examCheck system mentions task", () => {
    const r = buildWorkAssistant("examCheck");
    expect(r.systemPrompt).toContain("任务：试卷检查");
  });

  it("work-assistant 保持四路独立 system prompt", () => {
    const prompts = ([
      "lessonPolish",
      "ideologyMining",
      "questionAnalysis",
      "examCheck",
    ] as const).map((toolKey) => buildWorkAssistant(toolKey).systemPrompt);

    expect(new Set(prompts).size).toBe(4);
    expect(prompts[0]).toContain("任务：完善教案");
    expect(prompts[1]).toContain("任务：课程思政挖掘");
    expect(prompts[2]).toContain("任务：题目解析");
    expect(prompts[3]).toContain("任务：试卷检查");
  });

  it.each(["lessonPolish", "ideologyMining", "questionAnalysis"] as const)(
    "%s 输出契约不含 gradingTable",
    (toolKey) => {
      expect(buildWorkAssistant(toolKey).userPrompt).not.toContain('"gradingTable"');
    },
  );

  it("examCheck 输出契约保留 gradingTable", () => {
    expect(buildWorkAssistant("examCheck").userPrompt).toContain('"gradingTable"');
  });

  it.each([
    [
      "lessonPolish",
      { lessonHours: "专属课时-2课时", educationStage: "专属学段-中职", studentFoundation: "专属基础-参差" },
      ["专属课时-2课时", "专属学段-中职", "专属基础-参差"],
    ],
    [
      "ideologyMining",
      { majorDirection: "专属专业-金融管理", educationStage: "专属学段-高职" },
      ["专属专业-金融管理", "专属学段-高职"],
    ],
    [
      "questionAnalysis",
      { questionCount: "专属题量-3", knowledgeScope: "专属范围-复利" },
      ["专属题量-3", "专属范围-复利"],
    ],
    [
      "examCheck",
      { standardAnswer: "专属答案-A", gradingCriteria: "专属评分-步骤分", fullScore: "专属满分-100" },
      ["专属答案-A", "专属评分-步骤分", "专属满分-100"],
    ],
  ] as const)("%s 把专属输入注入 prompt", (toolKey, extraFields, expectedValues) => {
    const prompt = buildWorkAssistant(toolKey, { ...extraFields }).userPrompt;
    for (const value of expectedValues) expect(prompt).toContain(value);
  });

  it.each(["lessonPolish", "ideologyMining", "questionAnalysis", "examCheck"] as const)(
    "%s 允许省略或留空专属输入",
    (toolKey) => {
      expect(() => buildWorkAssistant(toolKey)).not.toThrow();
      expect(buildWorkAssistant(toolKey, {}).userPrompt).not.toContain("undefined");
    },
  );
});
