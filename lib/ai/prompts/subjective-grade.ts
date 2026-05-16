import type { PromptBuilder } from "./types";

export interface SubjectiveGradeOpts {
  evaluatorPersona?: string;
  strictnessLevel: string;
  prompt: string;
  referenceAnswer?: string | null;
  rubric: Array<{ id: string; name: string; description?: string | null; maxPoints: number }>;
  studentAnswerText: string;
}

export const SUBJECTIVE_GRADE_PROMPT_VERSION = "v1";

export const buildSubjectiveGradePrompt: PromptBuilder<SubjectiveGradeOpts> = (opts) => {
  const systemPrompt = `${opts.evaluatorPersona || "你是一位资深的金融课程评估专家。"}

严格度: ${opts.strictnessLevel}
严格度说明：
- STRICT / VERY_STRICT: 仅在作答中有明确证据支撑时才给分，推断不计分。
- MODERATE: 合理推断可适当给分，但需注明依据。
- LENIENT: 只要方向正确即可给分，鼓励学生参与。

题目: ${opts.prompt}
${opts.referenceAnswer ? `参考答案: ${opts.referenceAnswer}` : ""}

评分标准:
${opts.rubric.map((r) => `- ${r.name} (满分${r.maxPoints}分): ${r.description || ""}`).join("\n")}`;

  const userPrompt = `学生作答:\n${opts.studentAnswerText}\n\n请按评分标准逐项评估，返回 JSON:
{"totalScore": 总分, "feedback": "总体评语", "rubricBreakdown": [{"criterionId": "ID", "score": 得分, "maxScore": 满分, "comment": "评语"}], "conceptTags": ["概念1","概念2","概念3"]}
criterionId 使用: ${opts.rubric.map((r) => r.id).join(", ")}
conceptTags 输出本次答卷涉及的 3-5 个金融教学核心概念标签（如"CAPM""资产配置""风险偏好"等），用于班级薄弱点聚合。`;

  return {
    systemPrompt,
    userPrompt,
    version: SUBJECTIVE_GRADE_PROMPT_VERSION,
  };
};
