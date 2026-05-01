import { prisma } from "@/lib/db/prisma";

interface AiToolDefinition {
  key: string;
  label: string;
  category: string;
  defaultModel: string;
  description: string;
  basePromptPreview: string;
}

export const AI_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    key: "simulationChat",
    label: "模拟对话回复",
    category: "课堂任务 · 模拟对话",
    defaultModel: "mimo-v2.5-pro",
    description: "学生对话时的 AI 客户回复、情绪与追问提示。",
    basePromptPreview: `你是一个金融理财场景中的模拟客户。请按照场景、人设、隐性需求和对话目标进行中文对话。
核心要求：每条回复 2-4 句话；像真实客户一样逐步透露需求；当学生解释得好时认可并追问，解释不清时礼貌追问；不要暴露 AI 身份。
输出严格 JSON：reply、mood_score、mood_label、student_perf、deviated_dimensions。若学生提交资产配置，必须点名回应具体配置项。`,
  },
  {
    key: "simulationGrading",
    label: "模拟对话批改",
    category: "课堂任务 · 模拟对话",
    defaultModel: "mimo-v2.5",
    description: "模拟对话结束后的 rubric 评分、评语和概念标签。",
    basePromptPreview: `你是一位资深的金融教育评估专家。根据任务要求、对话场景、学生与客户 transcript、rubric 和资产配置记录进行评估。
评分原则：严格度由任务配置决定；只依据对话证据给分；totalScore 必须等于 rubricBreakdown 分数之和；评语要具体并引用学生表现。
输出严格 JSON：totalScore、feedback、rubricBreakdown、conceptTags。`,
  },
  {
    key: "taskDraft",
    label: "课程素材任务草稿",
    category: "课堂任务 · 出题生成",
    defaultModel: "mimo-v2.5-pro",
    description: "任务向导中基于课程素材生成 Quiz、主观题或模拟对话完整草稿。",
    basePromptPreview: `你是一位面向中高职学校的课程教研与出题助手。根据课程、章节、小节、课程素材和教师高维需求生成可由教师审核的任务草稿。
边界：只围绕当前课程范围；题目和情境适合中高职课堂；概念标签只代表素材涉及概念；返回严格 JSON。
按任务类型填充 quiz / subjective / simulation 对象，并保留 draftNotes 说明填充来源。`,
  },
  {
    key: "quizDraft",
    label: "Quiz 生成",
    category: "课堂任务 · 出题生成",
    defaultModel: "mimo-v2.5-pro",
    description: "独立 AI 助手入口生成单选、多选、判断、简答混合测验。",
    basePromptPreview: `你是一位资深的金融课程出题专家。根据课程和章节信息生成高质量测验题目。
要求：包含单选、多选、判断、简答；题干清楚，选项互斥；判断题使用 T/F；每题给 points、difficulty、explanation；使用中文并返回严格 JSON。`,
  },
  {
    key: "subjectiveDraft",
    label: "主观题生成",
    category: "课堂任务 · 出题生成",
    defaultModel: "mimo-v2.5-pro",
    description: "独立 AI 助手入口生成主观题任务、参考答案与评分标准。",
    basePromptPreview: `你是一位资深的金融课程出题专家。根据课程、章节和教师要求生成一道可审核的主观题任务。
输出 taskName、requirements、prompt、referenceAnswer 和 3-5 项 scoringCriteria；总分建议 100 分；语言面向中高职学生。`,
  },
  {
    key: "importParse",
    label: "PDF/文档题目导入",
    category: "课堂任务 · 出题生成",
    defaultModel: "mimo-v2.5",
    description: "从 PDF、DOCX、ZIP 等材料识别题目并结构化为题库格式。",
    basePromptPreview: `你是一位金融课程题目提取专家。请从文档文本中识别单选题、多选题、判断题、简答题，并结构化输出。
规则：选项 id 使用 A/B/C/D；判断题使用 T/F；无法确定答案时留空；points 按题目复杂度给 1-5；返回严格 JSON。`,
  },
  {
    key: "quizGrade",
    label: "测验简答/标签批改",
    category: "课堂任务 · 批改",
    defaultModel: "mimo-v2.5",
    description: "Quiz 中简答题评分，以及测验概念标签提取。",
    basePromptPreview: `你是一位严谨的金融课程阅卷老师。根据题目、参考答案和学生作答评估简答题。
评分指导：完全匹配给满分；部分匹配按核心要点比例给分；不相关给 0；允许同义表达。另可基于题目 prompt 提取 3-5 个教学概念标签。`,
  },
  {
    key: "subjectiveGrade",
    label: "主观题批改",
    category: "课堂任务 · 批改",
    defaultModel: "mimo-v2.5",
    description: "主观题提交后的 rubric 评分、评语和概念标签。",
    basePromptPreview: `你是一位资深的金融课程评估专家。根据题目、参考答案、学生作答、评分标准和严格度逐项评分。
原则：严格度越高越强调明确证据；rubricBreakdown 必须覆盖每个 criterionId；输出 totalScore、feedback、rubricBreakdown、conceptTags。`,
  },
  {
    key: "studyBuddy",
    label: "学习伙伴",
    category: "学生支持",
    defaultModel: "mimo-v2.5",
    description: "学生按课程、章节和任务上下文发起提问后的学习引导与总结。",
    basePromptPreview: `你是一位金融教育的学习伙伴。基于学生选择的课程、章节、任务和教师补充上下文回答问题。
默认用引导式方式帮助学生澄清思路；直接回答模式下给清晰分步答案；不要替学生完成需独立提交的作业。`,
  },
  {
    key: "insights",
    label: "任务实例洞察",
    category: "教学洞察",
    defaultModel: "mimo-v2.5-pro",
    description: "基于提交反馈生成班级层面的弱点、建议和复盘摘要。",
    basePromptPreview: `你是一位资深的金融教育课程顾问。基于学生提交和 AI 批改反馈，归纳常见薄弱概念、班级差异、教师可行动建议。
AI 只负责总结和聚类，不替代确定性统计；必须说明依据和不确定点。`,
  },
  {
    key: "weeklyInsight",
    label: "AI 周洞察",
    category: "教学洞察",
    defaultModel: "mimo-v2.5-pro",
    description: "教师工作台和 Analytics V2 的一周备课洞察。",
    basePromptPreview: `你是一位资深的金融教育课程顾问。基于过去 7 天班级提交数据和接下来 7 天课表生成一周洞察。
输出结构化 JSON：弱点概念、班级差异、学生聚类、未来课程建议、教师下一步动作；不得编造数据。`,
  },
  {
    key: "lessonPolish",
    label: "教案完善",
    category: "AI 工作助手",
    defaultModel: "mimo-v2.5-pro",
    description: "上传或粘贴教案后，补充教学目标、活动、评价和课堂话术。",
    basePromptPreview: `你是面向中国大陆中高职学校的一线教师工作助手。任务：完善教案。
关注教学目标、重难点、课堂活动、评价任务、学生差异化支持、板书和课堂话术建议；输出必须可由教师审核后使用。`,
  },
  {
    key: "ideologyMining",
    label: "思政挖掘",
    category: "AI 工作助手",
    defaultModel: "mimo-v2.5-pro",
    description: "从专业课材料中自然提炼课程思政融合点。",
    basePromptPreview: `你是面向中国大陆中高职学校的一线教师工作助手。任务：课程思政挖掘。
输出要自然、克制、贴合专业课内容，避免生硬口号；给出融合目标、课堂提问、案例和表达边界。`,
  },
  {
    key: "questionAnalysis",
    label: "搜题与解析",
    category: "AI 工作助手",
    defaultModel: "mimo-v2.5",
    description: "识别题型、知识点、解题步骤、易错点和教学提示。",
    basePromptPreview: `你是面向中国大陆中高职学校的一线教师工作助手。任务：搜题与解析。
识别题型、知识点、解题步骤、易错点和教学提示；没有搜索 provider 时不要假装联网。`,
  },
  {
    key: "examCheck",
    label: "试卷检查",
    category: "AI 工作助手",
    defaultModel: "mimo-v2.5-pro",
    description: "上传标准答案、评分规则和学生试卷后辅助批改。",
    basePromptPreview: `你是面向中国大陆中高职学校的一线教师工作助手。任务：试卷检查。
根据标准答案/评分规则和学生作答逐题批改；无法确定时必须标记疑点，不要编造分数依据。`,
  },
];

export const AI_MODEL_OPTIONS = [
  { value: "mimo-v2.5-pro", label: "高质量", description: "适合复杂教案、思政融合、综合批改" },
  { value: "mimo-v2.5", label: "均衡", description: "适合学习伙伴、题目解析、常规生成" },
  { value: "mimo-v2-flash", label: "快速", description: "适合低成本快速草稿" },
  { value: "mimo-v2-omni", label: "多模态识别", description: "用于图片/试卷识别，需 OCR smoke test 通过" },
] as const;

export async function listAiToolSettings(teacherId: string) {
  const rows = await prisma.aiToolSetting.findMany({
    where: { teacherId },
    orderBy: { toolKey: "asc" },
  });
  const map = new Map(rows.map((row) => [row.toolKey, row]));

  return AI_TOOL_DEFINITIONS.map((definition) => {
    const row = map.get(definition.key);
    return {
      ...definition,
      model: row?.model || definition.defaultModel,
      thinking: row?.thinking || "disabled",
      temperature: row?.temperature ?? null,
      systemPromptSuffix: row?.systemPromptSuffix || "",
      enableSearch: row?.enableSearch ?? false,
      strictness: row?.strictness || "balanced",
      outputStyle: row?.outputStyle || "structured",
      updatedAt: row?.updatedAt || null,
    };
  });
}

export async function upsertAiToolSetting(
  teacherId: string,
  data: {
    toolKey: string;
    model?: string | null;
    thinking?: "disabled" | "enabled";
    temperature?: number | null;
    systemPromptSuffix?: string | null;
    enableSearch?: boolean;
    strictness?: string | null;
    outputStyle?: string | null;
  },
) {
  if (!AI_TOOL_DEFINITIONS.some((tool) => tool.key === data.toolKey)) {
    throw new Error("AI_TOOL_NOT_FOUND");
  }

  return prisma.aiToolSetting.upsert({
    where: {
      teacherId_toolKey: {
        teacherId,
        toolKey: data.toolKey,
      },
    },
    create: {
      teacherId,
      toolKey: data.toolKey,
      model: data.model || null,
      thinking: data.thinking || "disabled",
      temperature: data.temperature ?? null,
      systemPromptSuffix: data.systemPromptSuffix || null,
      enableSearch: data.enableSearch ?? false,
      strictness: data.strictness || null,
      outputStyle: data.outputStyle || null,
    },
    update: {
      model: data.model || null,
      thinking: data.thinking || "disabled",
      temperature: data.temperature ?? null,
      systemPromptSuffix: data.systemPromptSuffix || null,
      enableSearch: data.enableSearch ?? false,
      strictness: data.strictness || null,
      outputStyle: data.outputStyle || null,
    },
  });
}
