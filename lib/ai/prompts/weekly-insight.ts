import type { PromptBuilder } from "./types";

export interface WeeklyInsightOpts {
  windowStart: Date;
  windowEnd: Date;
  submissions: Array<{
    submissionId: string;
    studentName: string;
    className: string | null;
    courseTitle: string | null;
    chapterTitle: string | null;
    sectionTitle: string | null;
    taskName: string;
    taskType: string;
    score: number | null;
    maxScore: number | null;
    feedback: string;
    conceptTags: string[];
  }>;
  upcomingSlots: Array<{
    scheduleSlotId: string;
    courseId: string;
    courseTitle: string;
    date: string;
    weekday: string;
    time: string;
    classroom: string | null;
    className: string | null;
  }>;
}

export const WEEKLY_INSIGHT_PROMPT_VERSION = "v1";

export const buildWeeklyInsightPrompt: PromptBuilder<WeeklyInsightOpts> = (opts) => {
  const systemPrompt = `你是一位资深的金融教育课程顾问。基于教师过去 7 天班级提交数据 + 接下来 7 天课表，请生成结构化"一周洞察"，帮助教师在课前做有针对性的备课。

输出严格 JSON。必须基于提供的数据归纳，不得捏造分数、概念或班级。
对学生姓名仅引用提供的真实姓名；对概念标签仅在提供的 conceptTags 集合内挑选高频项。
若数据不足以归纳某一字段，请返回空数组或简短说明。`;

  // 限制 corpus 体积（防 token 爆）
  const submissionLines = opts.submissions
    .slice(0, 80)
    .map(
      (s, i) =>
        `[${i + 1}] sub=${s.submissionId} 学生=${s.studentName} 班级=${s.className ?? "（未关联）"} 课程=${s.courseTitle ?? "（未关联）"} 章节=${s.chapterTitle ?? "-"} 小节=${s.sectionTitle ?? "-"} 任务=${s.taskName}（${s.taskType}） 分=${s.score ?? "-"}/${s.maxScore ?? "-"} 概念=${s.conceptTags.join("|") || "-"} 反馈=${s.feedback.slice(0, 200)}`,
    )
    .join("\n");

  const upcomingLines = opts.upcomingSlots
    .slice(0, 12)
    .map(
      (u, i) =>
        `[${i + 1}] slotId=${u.scheduleSlotId} ${u.date} (${u.weekday}) ${u.time} 课程=${u.courseTitle} 班级=${u.className ?? "-"} 教室=${u.classroom ?? "-"}`,
    )
    .join("\n");

  const userPrompt = `时间窗口: ${opts.windowStart.toISOString().slice(0, 10)} ~ ${opts.windowEnd.toISOString().slice(0, 10)}

【过去 7 天 graded + released 提交数据 (${opts.submissions.length} 条)】
${submissionLines || "（无）"}

【接下来 7 天课表 (${opts.upcomingSlots.length} 节)】
${upcomingLines || "（无）"}

请按以下 JSON 格式输出（务必仅输出 JSON，不要 Markdown 代码块、不要其他文字）:
{
  "weakConceptsByCourse": [
    {
      "courseId": "课程ID",
      "courseTitle": "课程名",
      "concepts": [
        { "tag": "概念标签", "errorRate": 0.6, "exampleStudents": ["学生姓名1"] }
      ]
    }
  ],
  "classDifferences": [
    { "classId": "班级ID", "className": "班级名", "avgScore": 78, "summary": "简评 ≤60 字" }
  ],
  "studentClusters": [
    { "label": "聚类标签", "size": 5, "characteristics": "本类学生共性 ≤80 字" }
  ],
  "upcomingClassRecommendations": [
    { "scheduleSlotId": "课表 slotId", "courseTitle": "课程名", "date": "yyyy-mm-dd", "recommendation": "课前需重点讲解的方向 ≤120 字" }
  ],
  "highlightSummary": "本周教学需关注... ≤200 字"
}

要求:
- weakConceptsByCourse: 仅当某课程内同一概念被 ≥2 名学生明显答错（feedback 反馈中出现弱点）时纳入。errorRate 用 (该概念出错学生数 / 课程下答过该概念的学生数)。
- classDifferences: 列出本周有提交的班级；avgScore 取真实均分（如无可填 null）。
- studentClusters: 基于分数与 feedback 模式归纳 2-4 类即可。
- upcomingClassRecommendations: 仅针对接下来 7 天课表中真实存在的 slot；建议要把"过去 7 天该课程的弱点"映射到"下次课要讲什么"。
- highlightSummary: 一段总览，开头"本周教学需关注"。
`;

  return {
    systemPrompt,
    userPrompt,
    version: WEEKLY_INSIGHT_PROMPT_VERSION,
  };
};
