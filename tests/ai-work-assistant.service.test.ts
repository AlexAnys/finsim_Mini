import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
}));

vi.mock("@/lib/services/document-ingestion.service", () => ({
  extractDocumentText: vi.fn(),
}));

import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  examCheckResultSchema,
  runAiWorkAssistantJob,
  type WorkAssistantToolKey,
} from "@/lib/services/ai-work-assistant.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const gradingRow = {
  student: "测试学生",
  question: "第1题",
  score: "8",
  feedback: "步骤完整",
  uncertainty: "",
};

const aiPayload = {
  title: "测试结果",
  summary: "测试摘要",
  sections: [],
  actionItems: [],
  cautions: [],
  gradingTable: [gradingRow],
};

beforeEach(() => {
  vi.clearAllMocks();
  mk(aiGenerateJSON).mockImplementation(async (...args: unknown[]) => {
    const schema = args[4] as { parse: (value: unknown) => unknown };
    return schema.parse(aiPayload);
  });
});

async function run(toolKey: WorkAssistantToolKey) {
  return runAiWorkAssistantJob(
    {
      toolKey,
      text: "用于回归测试的材料",
      files: [],
    },
    "teacher-test",
  );
}

describe("AI work assistant · tool-specific output schema", () => {
  it.each(["lessonPolish", "ideologyMining", "questionAnalysis"] as const)(
    "%s 使用裁剪 schema 丢弃 gradingTable",
    async (toolKey) => {
      const result = await run(toolKey);

      expect(result.fallback).toBe(false);
      expect(result).not.toHaveProperty("gradingTable");
      expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(1);
      expect(mk(aiGenerateJSON).mock.calls[0][0]).toBe(toolKey);
    },
  );

  it("examCheck 使用专属 schema 保留 gradingTable", async () => {
    const result = await run("examCheck");

    expect(result.fallback).toBe(false);
    expect(result).toHaveProperty("gradingTable", [gradingRow]);
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(1);
    expect(mk(aiGenerateJSON).mock.calls[0][0]).toBe("examCheck");
  });

  it("examCheck 将模型返回的数字得分归一化为字符串", () => {
    const parsed = examCheckResultSchema.parse({
      ...aiPayload,
      gradingTable: [{ ...gradingRow, score: 3 }],
    });

    expect(parsed.gradingTable[0].score).toBe("3");
  });

  it("四个工具继续以各自 feature 调用 AI", async () => {
    for (const toolKey of [
      "lessonPolish",
      "ideologyMining",
      "questionAnalysis",
      "examCheck",
    ] as const) {
      await run(toolKey);
    }

    expect(mk(aiGenerateJSON).mock.calls.map((call) => call[0])).toEqual([
      "lessonPolish",
      "ideologyMining",
      "questionAnalysis",
      "examCheck",
    ]);
    expect(new Set(mk(aiGenerateJSON).mock.calls.map((call) => call[2])).size).toBe(4);
  });

  it("解析 route 透传的专属字段，并只注入当前工具白名单", async () => {
    await runAiWorkAssistantJob(
      {
        toolKey: "examCheck",
        text: "学生作答材料",
        extraFields: JSON.stringify({
          standardAnswer: "标准答案-A",
          gradingCriteria: "步骤正确得 8 分",
          fullScore: "100",
          lessonHours: "不应进入试卷 prompt",
        }),
        files: [],
      },
      "teacher-test",
    );

    const userPrompt = String(mk(aiGenerateJSON).mock.calls[0][3]);
    expect(userPrompt).toContain("标准答案-A");
    expect(userPrompt).toContain("步骤正确得 8 分");
    expect(userPrompt).toContain("不得超过满分“100”");
    expect(userPrompt).not.toContain("不应进入试卷 prompt");
  });
});
