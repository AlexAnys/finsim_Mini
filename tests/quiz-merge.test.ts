import { describe, it, expect } from "vitest";
import { mergeGeneratedQuestions } from "@/lib/utils/quiz-merge";

type QuizQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

interface QuizQuestion {
  type: QuizQuestionType;
  stem: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
}

function makeEmptyQ(): QuizQuestion {
  return {
    type: "single_choice",
    stem: "",
    options: [
      { id: "A", text: "" },
      { id: "B", text: "" },
      { id: "C", text: "" },
      { id: "D", text: "" },
    ],
    correctOptionIds: [],
    correctAnswer: "",
    points: 1,
    explanation: "",
  };
}

function makeRealQ(stem: string, points = 5): QuizQuestion {
  return {
    ...makeEmptyQ(),
    stem,
    points,
  };
}

describe("mergeGeneratedQuestions", () => {
  it("replaces the default blank question with generated ones", () => {
    const existing = [makeEmptyQ()];
    const generated = [makeRealQ("Q1"), makeRealQ("Q2")];
    const merged = mergeGeneratedQuestions(existing, generated);
    expect(merged).toHaveLength(2);
    expect(merged.map((q) => q.stem)).toEqual(["Q1", "Q2"]);
  });

  it("preserves non-empty default and appends generated", () => {
    const existing = [makeRealQ("my own Q")];
    const generated = [makeRealQ("Q1"), makeRealQ("Q2")];
    const merged = mergeGeneratedQuestions(existing, generated);
    expect(merged).toHaveLength(3);
    expect(merged.map((q) => q.stem)).toEqual(["my own Q", "Q1", "Q2"]);
  });

  it("appends when existing has multiple questions", () => {
    const existing = [makeRealQ("Q0-1"), makeRealQ("Q0-2"), makeEmptyQ()];
    const generated = [makeRealQ("Q1")];
    const merged = mergeGeneratedQuestions(existing, generated);
    expect(merged).toHaveLength(4);
    expect(merged[3].stem).toBe("Q1");
  });

  it("whitespace-only stem is treated as empty and gets replaced", () => {
    const existing = [makeRealQ("   \n\t  ")];
    const generated = [makeRealQ("Q1")];
    const merged = mergeGeneratedQuestions(existing, generated);
    expect(merged).toHaveLength(1);
    expect(merged[0].stem).toBe("Q1");
  });

  it("no generated questions returns original list unchanged", () => {
    const existing = [makeRealQ("my own Q")];
    const merged = mergeGeneratedQuestions(existing, []);
    expect(merged).toEqual(existing);
  });
});
