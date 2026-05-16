import { describe, it, expect } from "vitest";
import {
  buildTaskDraftFromContextPrompt,
  TASK_DRAFT_FROM_CONTEXT_PROMPT_VERSION,
} from "@/lib/ai/prompts/task-draft-from-context";
import {
  buildTaskDraftQuizPrompt,
  TASK_DRAFT_QUIZ_PROMPT_VERSION,
} from "@/lib/ai/prompts/task-draft-quiz";
import {
  buildTaskDraftSubjectivePrompt,
  TASK_DRAFT_SUBJECTIVE_PROMPT_VERSION,
} from "@/lib/ai/prompts/task-draft-subjective";
import {
  buildImportParsePrompt,
  IMPORT_PARSE_PROMPT_VERSION,
} from "@/lib/ai/prompts/import-parse";
import {
  buildCourseKnowledgeSummaryPrompt,
  COURSE_KNOWLEDGE_SUMMARY_PROMPT_VERSION,
} from "@/lib/ai/prompts/course-knowledge-summary";
import {
  buildCourseOutlinePrompt,
  COURSE_OUTLINE_PROMPT_VERSION,
} from "@/lib/ai/prompts/course-outline";

describe("task-draft + import + outline prompt builders (PR-1 E)", () => {
  it("task-draft-from-context (quiz) snapshot", () => {
    const r = buildTaskDraftFromContextPrompt({
      taskType: "quiz",
      courseName: "个人理财规划",
      courseDescription: "面向金融2024",
      chapterName: "复利",
      sectionName: "应用",
      sources: [],
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(TASK_DRAFT_FROM_CONTEXT_PROMPT_VERSION);
  });

  it("task-draft-from-context system typeLabel changes for simulation", () => {
    const r = buildTaskDraftFromContextPrompt({
      taskType: "simulation",
      courseName: "x",
      courseDescription: null,
      chapterName: "y",
      sectionName: "z",
      sources: [],
    });
    expect(r.systemPrompt).toContain("模拟对话草稿");
  });

  it("task-draft-quiz snapshot", () => {
    const r = buildTaskDraftQuizPrompt({ courseName: "理财", chapterName: "复利" });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(TASK_DRAFT_QUIZ_PROMPT_VERSION);
  });

  it("task-draft-subjective snapshot", () => {
    const r = buildTaskDraftSubjectivePrompt({ courseName: "理财", chapterName: "复利" });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(TASK_DRAFT_SUBJECTIVE_PROMPT_VERSION);
  });

  it("import-parse snapshot", () => {
    const r = buildImportParsePrompt({ truncatedText: "Q1. 复利 ..." });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(IMPORT_PARSE_PROMPT_VERSION);
  });

  it("course-knowledge-summary snapshot", () => {
    const r = buildCourseKnowledgeSummaryPrompt({
      fileName: "chapter1.docx",
      extractedText: "复利原理...",
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(COURSE_KNOWLEDGE_SUMMARY_PROMPT_VERSION);
  });

  it("course-outline compact snapshot", () => {
    const r = buildCourseOutlinePrompt({
      fileName: "outline.xlsx",
      extractedText: "章节1...",
      compact: true,
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(COURSE_OUTLINE_PROMPT_VERSION);
  });

  it("course-outline full snapshot", () => {
    const r = buildCourseOutlinePrompt({
      fileName: "outline.xlsx",
      extractedText: "章节1...",
      compact: false,
    });
    expect(r.userPrompt).toContain("taskSuggestions");
  });
});
