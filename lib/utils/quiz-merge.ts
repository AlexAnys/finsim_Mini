interface MergeableQuiz {
  stem: string;
}

export function mergeGeneratedQuestions<T extends MergeableQuiz>(
  existing: T[],
  generated: T[]
): T[] {
  const onlyDefaultEmpty = existing.length === 1 && !existing[0].stem.trim();
  return onlyDefaultEmpty ? generated : [...existing, ...generated];
}
