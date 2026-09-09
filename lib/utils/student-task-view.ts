/** Redact teacher-only material at every student response boundary, including nested snapshots. */
const TEACHER_FIELDS = new Set([
  "correctOptionIds", "correctAnswer", "referenceAnswer", "explanation",
  "systemPrompt", "evaluatorPersona", "strictnessLevel",
]);
export function studentTaskView<T>(value: T): T {
  if (Array.isArray(value)) return value.map(studentTaskView) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  // Preserve Prisma Decimal and other scalar serializers.
  if ("toJSON" in value && typeof value.toJSON === "function") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !TEACHER_FIELDS.has(key))
    .map(([key, child]) => [key, studentTaskView(child)])) as T;
}
