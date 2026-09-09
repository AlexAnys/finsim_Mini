/** A published AI-graded task must have executable scoring criteria; drafts may be incomplete. */
export function hasUsableRubric(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const ids = new Set<string>();
  let total = 0;
  for (const criterion of value) {
    if (!criterion || typeof criterion !== "object" || typeof criterion.name !== "string" || !criterion.name.trim()
      || typeof criterion.maxPoints !== "number" || !Number.isFinite(criterion.maxPoints) || criterion.maxPoints <= 0) return false;
    if (typeof criterion.id === "string") {
      if (ids.has(criterion.id)) return false;
      ids.add(criterion.id);
    }
    total += criterion.maxPoints;
  }
  return Number.isFinite(total) && total > 0;
}
