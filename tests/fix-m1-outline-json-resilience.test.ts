import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * M1 (PR #11) · Outline AI JSON 解析容错
 *
 * 验证：
 *  1. tryRepairTruncatedJSON 修复 array 中段截断（Molly 实际 case）。
 *  2. processCourseKnowledgeSource (syllabus) 在第一次 AI 报错时走 compact retry。
 *  3. compact retry 也失败 → 写 ai_summary_failed + 中文 error。
 *  4. 正常 syllabus 路径不退化（不走 retry，单次成功）。
 */

import { tryRepairTruncatedJSON } from "@/lib/services/ai.service";

describe("M1 · tryRepairTruncatedJSON", () => {
  it("修复 array 中段截断（Molly 实际 case：'Expected , or ] after array element'）", () => {
    const truncated = `{
      "courseGoals": ["目标A", "目标B"],
      "chapters": [
        {"title": "第一章", "order": 0, "sections": [
          {"title": "1.1", "knowledgePoints": ["现金流"]},
          {"title": "1.2", "knowledgePoints": ["预算`;
    const repaired = tryRepairTruncatedJSON(truncated);
    expect(repaired).not.toBeNull();
    const parsed = JSON.parse(repaired!);
    expect(parsed.courseGoals).toEqual(["目标A", "目标B"]);
    expect(Array.isArray(parsed.chapters)).toBe(true);
    expect(parsed.chapters[0].title).toBe("第一章");
    // 截断的最后一个 section "1.2" 因 knowledgePoints 数组没收尾，会被 repair 安全丢弃
    // （取决于 lastSafeEnd 落点；至少 1.1 应该被保留）
    expect(parsed.chapters[0].sections.length).toBeGreaterThanOrEqual(1);
    expect(parsed.chapters[0].sections[0].title).toBe("1.1");
  });

  it("修复 object 中部尾随逗号截断", () => {
    const truncated = `{"a": 1, "b": [1, 2, 3,`;
    const repaired = tryRepairTruncatedJSON(truncated);
    expect(repaired).not.toBeNull();
    const parsed = JSON.parse(repaired!);
    expect(parsed.a).toBe(1);
    expect(parsed.b).toEqual([1, 2, 3]);
  });

  it("修复未闭合字符串（partial string 视为不可恢复 → 字段降级为 null）", () => {
    const truncated = `{"title": "未完的字符`;
    const repaired = tryRepairTruncatedJSON(truncated);
    expect(repaired).not.toBeNull();
    const parsed = JSON.parse(repaired!);
    // 合法 JSON：title 字段存在，且要么是 null（partial string 安全丢弃），要么是合法 string
    expect("title" in parsed).toBe(true);
    expect(parsed.title === null || typeof parsed.title === "string").toBe(true);
  });

  it("已合法 JSON 直接返回原串（不破坏）", () => {
    const valid = `{"a":1,"b":[1,2,3]}`;
    const repaired = tryRepairTruncatedJSON(valid);
    expect(repaired).toBe(valid);
  });

  it("括号不匹配时放弃修复（返回 null）", () => {
    // ] 没有对应的 [
    const bad = `{"a": 1] }`;
    const repaired = tryRepairTruncatedJSON(bad);
    expect(repaired).toBeNull();
  });

  it("空串 / null 串 返回 null", () => {
    expect(tryRepairTruncatedJSON("")).toBeNull();
  });

  it("修复深嵌 outline 结构（Molly XLSX 经典 case）", () => {
    // 模拟 maxOutputTokens=8192 被截在 chapters[].sections[].taskSuggestions[].rationale 中
    const truncated = `{
      "courseGoals": ["培养理财规划专业能力"],
      "knowledgeObjectives": ["现金流管理", "风险评估"],
      "skillObjectives": [],
      "valueObjectives": [],
      "assessmentRequirements": [],
      "chapters": [
        {
          "title": "第一章 个人理财概述",
          "order": 0,
          "learningGoals": ["理解理财基本概念"],
          "knowledgeObjectives": [],
          "skillObjectives": [],
          "sections": [
            {
              "title": "1.1 理财定义",
              "order": 0,
              "learningGoals": [],
              "knowledgeObjectives": [],
              "skillObjectives": [],
              "knowledgePoints": ["理财定义", "理财目标"],
              "taskSuggestions": [
                {"slot": "pre", "taskType": "quiz", "title": "课前测验", "rationale": "测试基础概`;

    const repaired = tryRepairTruncatedJSON(truncated);
    expect(repaired).not.toBeNull();
    const parsed = JSON.parse(repaired!);
    expect(parsed.courseGoals[0]).toContain("理财");
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0].title).toContain("第一章");
    expect(parsed.chapters[0].sections[0].title).toBe("1.1 理财定义");
    expect(parsed.chapters[0].sections[0].knowledgePoints).toEqual(["理财定义", "理财目标"]);
  });
});

// ============================================
// Integration: processCourseKnowledgeSource (syllabus) 走 compact retry
// ============================================

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    courseKnowledgeSource: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/services/document-ingestion.service", () => ({
  detectDocumentKind: vi.fn().mockReturnValue("xlsx"),
  extractDocumentText: vi.fn().mockResolvedValue({
    kind: "xlsx",
    status: "ready",
    text: "课程标题：个人理财\n章节：现金流管理；预算编制；风险评估\n".repeat(50),
    warnings: [],
    error: null,
  }),
  isReadableExtractedText: vi.fn().mockReturnValue(true),
  toKnowledgeSourceKind: (k: string) => (k === "doc" ? "docx" : k),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("xlsx data")),
  unlink: vi.fn(),
}));

vi.mock("@/lib/services/ai.service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/ai.service")>();
  return {
    ...actual,
    aiGenerateJSON: vi.fn(),
  };
});

import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import { processCourseKnowledgeSource } from "@/lib/services/course-knowledge-source.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mk(prisma.courseKnowledgeSource.findUnique).mockResolvedValue({
    id: "src-1",
    fileName: "outline.xlsx",
    filePath: "uploads/x.xlsx",
    mimeType: "application/vnd.ms-excel",
    sourceType: "syllabus",
    courseId: "course-1",
  });
  mk(prisma.courseKnowledgeSource.update).mockResolvedValue({});
});

describe("M1 · processCourseKnowledgeSource (syllabus) — JSON resilience", () => {
  it("正常 syllabus 路径：单次 AI 成功，不走 compact retry", async () => {
    const summaryResult = { summary: "课程素材摘要", conceptTags: ["现金流"] };
    const outlineResult = {
      courseGoals: ["目标 A"],
      knowledgeObjectives: [],
      skillObjectives: [],
      valueObjectives: [],
      assessmentRequirements: [],
      chapters: [
        {
          title: "第一章",
          order: 0,
          learningGoals: [],
          knowledgeObjectives: [],
          skillObjectives: [],
          sections: [
            {
              title: "1.1",
              order: 0,
              learningGoals: [],
              knowledgeObjectives: [],
              skillObjectives: [],
              knowledgePoints: ["现金流定义"],
              taskSuggestions: [],
            },
          ],
        },
      ],
      globalKnowledgePoints: [],
      notes: "",
    };

    mk(aiGenerateJSON)
      .mockResolvedValueOnce(summaryResult) // summary call
      .mockResolvedValueOnce(outlineResult); // outline call (single)

    await processCourseKnowledgeSource("src-1", "user-1");

    expect(aiGenerateJSON).toHaveBeenCalledTimes(2); // summary + outline (no retry)

    // 最后一次 update 应该是 ready 状态
    const updateCalls = mk(prisma.courseKnowledgeSource.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("ready");
    expect(finalUpdate.data.error).toBeNull();
  });

  it("第一次 outline AI 失败 → 走 compact retry → 成功 → ready", async () => {
    const summaryResult = { summary: "摘要", conceptTags: [] };
    const outlineRetryResult = {
      courseGoals: ["精简目标"],
      knowledgeObjectives: [],
      skillObjectives: [],
      valueObjectives: [],
      assessmentRequirements: [],
      chapters: [
        {
          title: "第一章",
          order: 0,
          learningGoals: [],
          knowledgeObjectives: [],
          skillObjectives: [],
          sections: [
            { title: "1.1", order: 0, learningGoals: [], knowledgeObjectives: [], skillObjectives: [], knowledgePoints: [], taskSuggestions: [] },
          ],
        },
      ],
      globalKnowledgePoints: [],
      notes: "",
    };

    mk(aiGenerateJSON)
      .mockResolvedValueOnce(summaryResult) // summary
      .mockRejectedValueOnce(new SyntaxError("Expected ',' or ']' after array element"))
      .mockResolvedValueOnce(outlineRetryResult); // compact retry

    await processCourseKnowledgeSource("src-1", "user-1");

    expect(aiGenerateJSON).toHaveBeenCalledTimes(3); // summary + outline + compact-retry

    // 第二次 outline 调用应使用 compact prompt（更短素材）
    const thirdCall = mk(aiGenerateJSON).mock.calls[2];
    // arg[3] = userPrompt
    const compactPrompt = thirdCall[3] as string;
    expect(compactPrompt).toContain("精简版");
    // arg[6] = options（maxOutputTokens / metadata）
    const options = thirdCall[6];
    expect(options.maxOutputTokens).toBe(16384);
    expect(options.metadata.parser).toBe("syllabus-outline-compact-retry");

    const updateCalls = mk(prisma.courseKnowledgeSource.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("ready");
  });

  it("compact retry 也失败 → ai_summary_failed + 中文 error", async () => {
    mk(aiGenerateJSON)
      .mockResolvedValueOnce({ summary: "", conceptTags: [] }) // summary
      .mockRejectedValueOnce(new Error("Expected ',' or ']' after array element in JSON at position 9845"))
      .mockRejectedValueOnce(new Error("Expected ',' or ']' after array element in JSON at position 6201"));

    await processCourseKnowledgeSource("src-1", "user-1");

    const updateCalls = mk(prisma.courseKnowledgeSource.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("ai_summary_failed");
    expect(finalUpdate.data.error).toContain("课程大纲解析暂不可用");
  });

  it("第一次 outline 使用 16384 maxOutputTokens（提升上限避免截断）", async () => {
    mk(aiGenerateJSON)
      .mockResolvedValueOnce({ summary: "", conceptTags: [] })
      .mockResolvedValueOnce({
        courseGoals: [],
        knowledgeObjectives: [],
        skillObjectives: [],
        valueObjectives: [],
        assessmentRequirements: [],
        chapters: [
          {
            title: "第一章",
            order: 0,
            learningGoals: [],
            knowledgeObjectives: [],
            skillObjectives: [],
            sections: [],
          },
        ],
        globalKnowledgePoints: [],
        notes: "",
      });

    await processCourseKnowledgeSource("src-1", "user-1");

    // 第二次调用（outline）应传入 maxOutputTokens: 16384
    const outlineCall = mk(aiGenerateJSON).mock.calls[1];
    const options = outlineCall[6];
    expect(options.maxOutputTokens).toBe(16384);
    expect(options.metadata.parser).toBe("syllabus-outline");
  });

  // ============================================
  // M1 r2 · ready+empty edge case guard
  // ============================================

  it("M1 r2 · 第一次 outline 解出 chapters=[] → 不直接 ready，走 compact retry", async () => {
    const summaryResult = { summary: "", conceptTags: [] };
    const emptyOutline = {
      courseGoals: [],
      knowledgeObjectives: [],
      skillObjectives: [],
      valueObjectives: [],
      assessmentRequirements: [],
      chapters: [], // ← partial parse 修复后字段 default 空数组的危险路径
      globalKnowledgePoints: [],
      notes: "",
    };
    const validRetryOutline = {
      courseGoals: ["精简目标"],
      knowledgeObjectives: [],
      skillObjectives: [],
      valueObjectives: [],
      assessmentRequirements: [],
      chapters: [
        {
          title: "第一章",
          order: 0,
          learningGoals: [],
          knowledgeObjectives: [],
          skillObjectives: [],
          sections: [],
        },
      ],
      globalKnowledgePoints: [],
      notes: "",
    };

    mk(aiGenerateJSON)
      .mockResolvedValueOnce(summaryResult)
      .mockResolvedValueOnce(emptyOutline) // 第一次 ok 但 chapters 空
      .mockResolvedValueOnce(validRetryOutline); // compact retry 才补上

    await processCourseKnowledgeSource("src-1", "user-1");

    // 必须走 compact retry，不能直接信任空目录
    expect(aiGenerateJSON).toHaveBeenCalledTimes(3);
    const retryCall = mk(aiGenerateJSON).mock.calls[2];
    expect(retryCall[6].metadata.parser).toBe("syllabus-outline-compact-retry");

    const updateCalls = mk(prisma.courseKnowledgeSource.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("ready");
    // 落盘 structuredData 一定是 retry 的非空版本
    expect(finalUpdate.data.structuredData).toBe(validRetryOutline);
  });

  it("M1 r2 · 两次都解出 chapters=[] → ai_summary_failed + 中文 error（不让老师看到空目录的 ready）", async () => {
    const emptyOutline = {
      courseGoals: [],
      knowledgeObjectives: [],
      skillObjectives: [],
      valueObjectives: [],
      assessmentRequirements: [],
      chapters: [],
      globalKnowledgePoints: [],
      notes: "",
    };

    mk(aiGenerateJSON)
      .mockResolvedValueOnce({ summary: "", conceptTags: [] })
      .mockResolvedValueOnce(emptyOutline)
      .mockResolvedValueOnce(emptyOutline); // compact retry 也空

    await processCourseKnowledgeSource("src-1", "user-1");

    const updateCalls = mk(prisma.courseKnowledgeSource.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("ai_summary_failed");
    expect(finalUpdate.data.error).toContain("课程大纲解析暂不可用");
    // 中文兜底文案：当第一次没 throw 而是空数组时，error 用静态文案
    expect(finalUpdate.data.error).toContain("AI 未能");
  });

  it("M1 r2 · 第一次 throw + compact retry 解出空 → ai_summary_failed", async () => {
    const emptyOutline = {
      courseGoals: [],
      knowledgeObjectives: [],
      skillObjectives: [],
      valueObjectives: [],
      assessmentRequirements: [],
      chapters: [],
      globalKnowledgePoints: [],
      notes: "",
    };

    mk(aiGenerateJSON)
      .mockResolvedValueOnce({ summary: "", conceptTags: [] })
      .mockRejectedValueOnce(new SyntaxError("Expected ',' or ']' after array element"))
      .mockResolvedValueOnce(emptyOutline);

    await processCourseKnowledgeSource("src-1", "user-1");

    const updateCalls = mk(prisma.courseKnowledgeSource.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("ai_summary_failed");
    // 第一次 SyntaxError 的真实 message 会被 forwarded（不是静态文案）
    expect(finalUpdate.data.error).toContain("课程大纲解析暂不可用");
    expect(finalUpdate.data.error).toContain("Expected");
  });
});
