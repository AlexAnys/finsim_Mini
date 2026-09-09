import { z } from "zod";

/** A malformed evaluation is a grading failure, never a student's zero. */
export function createRubricEvaluationSchema(
  rubric: ReadonlyArray<{ id: string; maxPoints: number }>,
  options: { requireEvidence?: boolean } = {},
) {
  const evidence = z.array(z.object({ studentText: z.string(), comment: z.string().min(1) })).max(3);
  return z.object({
    totalScore: z.number().finite(),
    feedback: z.string().min(1),
    rubricBreakdown: z.array(z.object({
      criterionId: z.string(),
      score: z.number().finite().nonnegative(),
      maxScore: z.number().finite().nonnegative(),
      comment: z.string().min(1),
      evidence: options.requireEvidence ? evidence.min(1) : evidence.default([]),
    })).length(rubric.length),
    conceptTags: z.array(z.string()).max(5).optional(),
  }).superRefine((result, ctx) => {
    const seen = new Set<string>();
    for (const [index, item] of result.rubricBreakdown.entries()) {
      const criterion = rubric.find((r) => r.id === item.criterionId);
      if (!criterion || seen.has(item.criterionId)) {
        ctx.addIssue({ code: "custom", path: ["rubricBreakdown", index, "criterionId"], message: "评分标准必须完整且不重复" });
      } else if (item.maxScore !== criterion.maxPoints || item.score > criterion.maxPoints) {
        ctx.addIssue({ code: "custom", path: ["rubricBreakdown", index, "score"], message: "评分超出任务标准范围" });
      }
      seen.add(item.criterionId);
    }
    const sum = result.rubricBreakdown.reduce((total, item) => total + item.score, 0);
    if (Math.abs(result.totalScore - sum) > 0.01) {
      ctx.addIssue({ code: "custom", path: ["totalScore"], message: "总分与分项合计不一致" });
    }
  });
}
