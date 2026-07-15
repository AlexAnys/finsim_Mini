export type QuizQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

export interface QuizOptionDraft {
  id: string;
  text: string;
}

export interface QuizQuestionDraft {
  type: QuizQuestionType;
  stem: string;
  options: QuizOptionDraft[];
  correctOptionIds: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
}

export interface QuizQuestionPayload {
  type: QuizQuestionType;
  prompt: string;
  options?: QuizOptionDraft[];
  correctOptionIds?: string[];
  correctAnswer?: string;
  points: number;
  order: number;
  explanation?: string;
}

const TRUE_FALSE_OPTIONS: QuizOptionDraft[] = [
  { id: "A", text: "正确" },
  { id: "B", text: "错误" },
];

function compactQuizOptions(options: QuizOptionDraft[]): QuizOptionDraft[] {
  return options
    .map((option) => ({ id: option.id.trim(), text: option.text.trim() }))
    .filter((option) => option.id && option.text);
}

export function isQuizQuestionComplete(question: QuizQuestionDraft): boolean {
  if (!question.stem.trim()) return false;
  if (question.type === "short_answer") return Boolean(question.correctAnswer.trim());
  if (question.type === "true_false") {
    return question.correctOptionIds.length === 1 &&
      ["A", "B"].includes(question.correctOptionIds[0]);
  }

  const options = compactQuizOptions(question.options);
  if (options.length < 2) return false;
  if (question.type === "single_choice" && question.correctOptionIds.length !== 1) return false;
  if (question.type === "multiple_choice" && question.correctOptionIds.length === 0) return false;
  const optionIds = new Set(options.map((option) => option.id));
  return question.correctOptionIds.every((id) => optionIds.has(id));
}

export function buildQuizQuestionPayload(
  question: QuizQuestionDraft,
  order: number,
): QuizQuestionPayload {
  const base = {
    type: question.type,
    prompt: question.stem.trim(),
    points: question.points,
    order,
    explanation: question.explanation.trim() || undefined,
  };

  if (question.type === "short_answer") {
    return { ...base, correctAnswer: question.correctAnswer.trim() || undefined };
  }

  return {
    ...base,
    options:
      question.type === "true_false"
        ? TRUE_FALSE_OPTIONS.map((option) => ({ ...option }))
        : compactQuizOptions(question.options),
    correctOptionIds: question.correctOptionIds,
  };
}

export function normalizeStoredQuizOptions(options: unknown): QuizOptionDraft[] | null {
  if (!Array.isArray(options)) return null;

  return options.map((value, index) => {
    const option = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const id =
      (typeof option.id === "string" ? option.id.trim() : "") ||
      (typeof option.label === "string" ? option.label.trim() : "") ||
      String.fromCharCode(65 + index);
    const text =
      typeof option.text === "string"
        ? option.text
        : typeof option.content === "string"
          ? option.content
          : "";
    return { id, text };
  });
}
