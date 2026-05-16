import type { PromptBuilder } from "./types";

export interface SimulationEvaluateOpts {
  taskName: string;
  requirements?: string;
  scenario: string;
  evaluatorPersona?: string;
  strictnessLevel: string;
  rubric: Array<{ id: string; name: string; description?: string; maxPoints: number }>;
  /** transcript 拼成的"理财经理: ... / 客户: ..."字符串（已剥 [MOOD:] 标签 + 30000 字截断） */
  transcriptText: string;
  /** 最终资产配置区块字符串（无配置时传空字符串） */
  finalAllocations: string;
  /** 配置演变快照区块字符串（无快照时传空字符串） */
  snapshotsBlock: string;
}

export const SIMULATION_EVALUATE_PROMPT_VERSION = "v1";

export const buildSimulationEvaluatePrompt: PromptBuilder<SimulationEvaluateOpts> = (opts) => {
  const systemPrompt = `${opts.evaluatorPersona || "你是一位资深的金融教育评估专家。"}

你正在评估一场模拟理财咨询对话。

任务: ${opts.taskName}
${opts.requirements ? `要求: ${opts.requirements}` : ""}
场景: ${opts.scenario}

严格度: ${opts.strictnessLevel}
严格度说明：
- STRICT / VERY_STRICT: 仅在对话中有明确证据支撑时才给分，推断不计分。
- MODERATE: 合理推断可适当给分，但需注明依据。
- LENIENT: 只要方向正确即可给分，鼓励学生参与。

重要评估原则：
1. 对话中的 [MOOD:] 标签反映了客户的真实情绪反应，请将其作为客户满意度的强信号。ANGRY 出现较多说明理财经理沟通存在严重问题。
2. totalScore 必须等于 rubricBreakdown 中所有 score 之和，不得凭空修改。
3. 评语要具体，引用对话中的原文作为依据。
4. 每项 rubric 必须返回 evidence 数组（1-3 条），格式 {studentText, comment}：
   - studentText 必须是 transcript 中"理财经理"（即学生）角色的**精确原句**（逐字引用，不得改写、不得跨行拼接、不得加引号/省略号）。
   - comment 解释这句话如何对应该 rubric 评分。
   - 没有可引用原句时，studentText 设为 ""（空字符串），并在 comment 中说明缺失原因（不影响 score）。
   - 不要引用 [MOOD:...] 标签内的内容，引用时去除 MOOD 部分。

评分标准:
${opts.rubric.map((r) => `- ${r.name} (满分${r.maxPoints}分): ${r.description || ""}`).join("\n")}`;

  const userPrompt = `对话记录:\n${opts.transcriptText}\n\n${opts.finalAllocations}${opts.snapshotsBlock}请按照评分标准逐项评估，返回 JSON:
{
  "totalScore": 总分,
  "feedback": "总体评语",
  "rubricBreakdown": [
    {
      "criterionId": "标准ID",
      "score": 得分,
      "maxScore": 满分,
      "comment": "评语",
      "evidence": [
        {"studentText": "理财经理原句（必须逐字摘自上方对话）", "comment": "为何此句对应该 rubric 的得分"}
      ]
    }
  ],
  "conceptTags": ["核心概念1", "核心概念2", "核心概念3"]
}

注意:
- rubricBreakdown 必须包含恰好 ${opts.rubric.length} 项，对应每个评分标准。
- criterionId 使用以下 ID: ${opts.rubric.map((r) => r.id).join(", ")}
- evidence 数组每项 1-3 条；studentText 必须能在上方对话中找到完全相同的子串（包括标点和空格）。
- conceptTags 输出本次答卷涉及的 3-5 个金融教学核心概念标签（如"CAPM""资产配置""风险偏好"等），用于后续班级薄弱点聚合。`;

  return {
    systemPrompt,
    userPrompt,
    version: SIMULATION_EVALUATE_PROMPT_VERSION,
  };
};

/** Unit 9 · evidence 引用 mismatch 时附加到 userPrompt 末尾的重试提示。 */
export function buildEvidenceRetryHint(mismatchedCount: number): string {
  return `\n\n注意：上一轮你引用的 ${mismatchedCount} 条 studentText 在对话记录中找不到对应原句。请仅引用对话记录中"理财经理"角色的逐字原话作为 evidence.studentText（不要改写、不要加引号、不要拼接多句）。若实在没有可引用的原句，studentText 设为 ""。`;
}
