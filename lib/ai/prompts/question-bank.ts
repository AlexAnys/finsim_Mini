import type { PromptBuilder } from "./types";

export interface QuestionBankOpts {
  action: "import" | "checkOptimize";
  courseName: string;
  courseDescription: string;
  chapterName: string;
  sectionName: string;
  teacherBrief: string;
  sources: Array<{
    id: string;
    fileName: string;
    summary: string | null;
    conceptTags: string[];
    text: string;
  }>;
  questions: Array<{
    type: string;
    stem: string;
    options: Array<{ id: string; text: string }>;
    correctOptionIds: string[];
    correctAnswer: string;
    explanation: string;
  }>;
}

export const QUESTION_BANK_PROMPT_VERSION = "v1";

export const buildQuestionBankPrompt: PromptBuilder<QuestionBankOpts> = (opts) => {
  const systemPrompt =
    opts.action === "import"
      ? `你是题库导入助手。任务是从教师上传的题库素材中忠实提取原始题目。

规则：
- 只提取素材中已有的题目、选项、答案、解析、知识点和来源位置。
- 不要私自补写缺失答案或解析；不明确时设置 needsReview=true，并在 issues 中说明。
- 题型只能是 single_choice、multiple_choice、true_false、short_answer。
- 保留原题表达，不做润色改写。
- 返回严格 JSON。`
      : `你是题库质检与优化助手。必须同时给出"质检"和"补充题"两类输出，不能只给抽象建议。

【质检要求】
逐题检查导入题目，把以下问题写入 issues 数组（每条带 questionIndex 和 sourceRef）：
- 缺答案 / 缺解析 / 答案疑似错误（结合素材上下文判断）
- 选项语义歧义、选项之间互斥不清、唯一正确选项不明显
- 重复题或近似题
- 题型分布异常（如全是单选、缺少判断或多选）
- 题干表述不清、含错别字、语病

【补题要求】
基于课程/章节/小节/素材实际内容，新增至少 3-5 道高质量补充题，每道题：
- 必须有完整 prompt + 选项 + correctOptionIds 或 correctAnswer + explanation（不能留空）
- 标记 aiSupplemented=true
- 题型应均衡：至少各包含 1 道 single_choice / multiple_choice / true_false 或 short_answer
- conceptTags 必须填实际知识点（≥1 个），不要写 "无" / "暂无"
- explanation 不少于 30 字，给出推导过程或参考依据
- sourceRefs 引用具体 sourceId 和原文摘录

【硬性规则】
- 不覆盖原导入题。
- 已有题目不在 questions 数组里返回；只返回新增补充题。
- 题目须贴合当前课程、章节、小节、素材；不要泛泛之谈。
- 即使素材较短，也要尽量挖出 3 道补题。
- 返回严格 JSON。`;

  const sourceText = opts.sources
    .map(
      (source, index) => `【素材 ${index + 1}: ${source.fileName}】
sourceId: ${source.id}
摘要：${source.summary || "无"}
概念：${source.conceptTags.join(" / ") || "无"}
正文摘录：
${source.text.slice(0, 7000)}`,
    )
    .join("\n\n");

  const questionText = opts.questions
    .map((question, index) => {
      const options = question.options.map((option) => `${option.id}. ${option.text}`).join("\n");
      const answer =
        question.type === "short_answer"
          ? question.correctAnswer
          : question.correctOptionIds.join(", ");
      return `【已有题目 ${index + 1}】
题型：${question.type}
题干：${question.stem}
选项：
${options || "无"}
答案：${answer || "未填写"}
解析：${question.explanation || "未填写"}`;
    })
    .join("\n\n");

  const userPrompt = `动作：${opts.action}
课程：${opts.courseName}
课程描述：${opts.courseDescription || "无"}
章节：${opts.chapterName || "未指定"}
小节：${opts.sectionName || "未指定"}
教师要求：${opts.teacherBrief || "未填写"}

课程素材：
${sourceText || "未选择素材。"}

当前题目：
${questionText || "暂无。"}

请返回 JSON：
{
  "summary": "本次导入/检查/优化的简短说明",
  "issues": [
    {"severity": "info|warning|critical", "message": "问题描述", "questionIndex": 0, "sourceRef": "页码或行号"}
  ],
  "questions": [
    {
      "type": "single_choice|multiple_choice|true_false|short_answer",
      "prompt": "题干",
      "options": [{"id": "A", "text": "选项文本"}],
      "correctOptionIds": ["A"],
      "correctAnswer": "简答参考答案",
      "explanation": "解析。缺失时留空",
      "points": 1,
      "conceptTags": ["知识点"],
      "sourceRefs": [{"sourceId": "素材ID", "fileName": "文件名", "page": "页码", "row": "行号", "excerpt": "原文片段"}],
      "confidence": 0.8,
      "needsReview": false,
      "aiSupplemented": ${opts.action === "checkOptimize" ? "true" : "false"},
      "issues": ["答案待确认"]
    }
  ]
}`;

  return {
    systemPrompt,
    userPrompt,
    version: QUESTION_BANK_PROMPT_VERSION,
  };
};
