import { describe, it, expect } from "vitest";
import {
  buildQuizShortAnswerGradePrompt,
  QUIZ_SHORT_ANSWER_GRADE_PROMPT_VERSION,
} from "@/lib/ai/prompts/quiz-short-answer-grade";
import {
  buildQuizConceptTagsPrompt,
  QUIZ_CONCEPT_TAGS_PROMPT_VERSION,
} from "@/lib/ai/prompts/quiz-concept-tags";
import {
  buildSubjectiveGradePrompt,
  SUBJECTIVE_GRADE_PROMPT_VERSION,
} from "@/lib/ai/prompts/subjective-grade";
import {
  buildQuizQuestionTaggerPrompt,
  QUIZ_QUESTION_TAGGER_PROMPT_VERSION,
} from "@/lib/ai/prompts/quiz-question-tagger";

describe("grading prompt builders (PR-1 E)", () => {
  it("quiz-short-answer-grade snapshot", () => {
    const r = buildQuizShortAnswerGradePrompt({
      prompt: "什么是复利？",
      referenceAnswer: "利息再产生利息",
      studentAnswer: "利滚利",
      maxPoints: 10,
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(QUIZ_SHORT_ANSWER_GRADE_PROMPT_VERSION);
  });

  it("quiz-concept-tags snapshot", () => {
    const r = buildQuizConceptTagsPrompt({
      promptsBlock: "1. 风险溢价\n2. 现金流贴现",
      totalCount: 2,
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(QUIZ_CONCEPT_TAGS_PROMPT_VERSION);
  });

  it("subjective-grade snapshot", () => {
    const r = buildSubjectiveGradePrompt({
      strictnessLevel: "STRICT",
      prompt: "请阐述资产配置的核心原则。",
      referenceAnswer: "分散投资、风险匹配...",
      rubric: [
        { id: "c1", name: "概念", description: "正确解释概念", maxPoints: 50 },
        { id: "c2", name: "案例", description: null, maxPoints: 50 },
      ],
      studentAnswerText: "资产配置就是把钱分开放",
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(SUBJECTIVE_GRADE_PROMPT_VERSION);
  });

  it("subjective-grade evaluatorPersona override", () => {
    const r = buildSubjectiveGradePrompt({
      evaluatorPersona: "你是李教授。",
      strictnessLevel: "MODERATE",
      prompt: "x",
      rubric: [],
      studentAnswerText: "y",
    });
    expect(r.systemPrompt.startsWith("你是李教授。")).toBe(true);
  });

  it("quiz-question-tagger snapshot", () => {
    const r = buildQuizQuestionTaggerPrompt({
      questionsBlock: "[1] questionId=q1 类型=single_choice 题干=股票风险高于债券",
      total: 1,
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(QUIZ_QUESTION_TAGGER_PROMPT_VERSION);
  });
});
