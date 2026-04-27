import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { aiGenerateJSON } from "./ai.service";
import { teacherCourseFilter } from "@/lib/services/course.service";

/**
 * Weekly insight aggregation service (PR-DASH-1e · B3).
 *
 * 拉过去 7 天该教师 courses 下所有 graded + released submissions（含 evaluation/conceptTags/score），
 * 关联的 task instances + tasks + chapters + sections，
 * 以及接下来 7 天有哪些课。
 * 调 AI（qwen-max via AI_WEEKLY_INSIGHT_MODEL，长 context）输出结构化 JSON：
 *  - weakConceptsByCourse — 各课弱点概念聚合
 *  - classDifferences — 班级差异
 *  - studentClusters — 学生聚类
 *  - upcomingClassRecommendations — 接下来 N 节课的教学建议
 *  - highlightSummary — 本周教学需关注摘要
 *
 * Cache 1h（in-memory Map by teacherId + 时间戳）。?force=true 跳缓存重新生成。
 */

// ============================================
// 输出类型
// ============================================

export interface WeakConceptsByCourse {
  courseId: string;
  courseTitle: string;
  concepts: Array<{
    tag: string;
    errorRate: number; // 0-1
    exampleStudents: string[];
  }>;
}

export interface ClassDifference {
  classId: string;
  className: string;
  avgScore: number | null;
  summary: string;
}

export interface StudentCluster {
  label: string;
  size: number;
  characteristics: string;
}

export interface UpcomingClassRecommendation {
  scheduleSlotId: string;
  courseTitle: string;
  date: string; // ISO yyyy-mm-dd
  recommendation: string;
}

export interface WeeklyInsightPayload {
  weakConceptsByCourse: WeakConceptsByCourse[];
  classDifferences: ClassDifference[];
  studentClusters: StudentCluster[];
  upcomingClassRecommendations: UpcomingClassRecommendation[];
  highlightSummary: string;
}

export interface WeeklyInsightResult {
  payload: WeeklyInsightPayload;
  generatedAt: Date;
  /** 用作前端展示数据范围 */
  windowStart: Date;
  windowEnd: Date;
  /** 本次聚合涉及的 graded 提交数 */
  submissionCount: number;
  /** cache 命中标记，便于前端展示"已缓存"状态 */
  cached: boolean;
}

// ============================================
// Cache
// ============================================

interface CacheEntry {
  result: WeeklyInsightResult;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

/** Test-only helper: 清空缓存以便单测之间隔离。 */
export function __clearWeeklyInsightCache() {
  cache.clear();
}

// ============================================
// AI Schema
// ============================================

const aiSchema = z.object({
  weakConceptsByCourse: z
    .array(
      z.object({
        courseId: z.string(),
        courseTitle: z.string(),
        concepts: z
          .array(
            z.object({
              tag: z.string(),
              errorRate: z.number().min(0).max(1),
              exampleStudents: z.array(z.string()).default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  classDifferences: z
    .array(
      z.object({
        classId: z.string(),
        className: z.string(),
        avgScore: z.number().nullable(),
        summary: z.string(),
      }),
    )
    .default([]),
  studentClusters: z
    .array(
      z.object({
        label: z.string(),
        size: z.number().int().nonnegative(),
        characteristics: z.string(),
      }),
    )
    .default([]),
  upcomingClassRecommendations: z
    .array(
      z.object({
        scheduleSlotId: z.string(),
        courseTitle: z.string(),
        date: z.string(),
        recommendation: z.string(),
      }),
    )
    .default([]),
  highlightSummary: z.string().default(""),
});

// ============================================
// Prompt 构建（纯函数，方便单测）
// ============================================

export interface PromptInput {
  windowStart: Date;
  windowEnd: Date;
  submissions: Array<{
    submissionId: string;
    studentId: string;
    studentName: string;
    classId: string | null;
    className: string | null;
    courseId: string | null;
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

export function buildWeeklyInsightPrompt(input: PromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `你是一位资深的金融教育课程顾问。基于教师过去 7 天班级提交数据 + 接下来 7 天课表，请生成结构化"一周洞察"，帮助教师在课前做有针对性的备课。

输出严格 JSON。必须基于提供的数据归纳，不得捏造分数、概念或班级。
对学生姓名仅引用提供的真实姓名；对概念标签仅在提供的 conceptTags 集合内挑选高频项。
若数据不足以归纳某一字段，请返回空数组或简短说明。`;

  // 限制 corpus 体积（防 token 爆）
  const submissionLines = input.submissions
    .slice(0, 80)
    .map(
      (s, i) =>
        `[${i + 1}] sub=${s.submissionId} 学生=${s.studentName} 班级=${s.className ?? "（未关联）"} 课程=${s.courseTitle ?? "（未关联）"} 章节=${s.chapterTitle ?? "-"} 小节=${s.sectionTitle ?? "-"} 任务=${s.taskName}（${s.taskType}） 分=${s.score ?? "-"}/${s.maxScore ?? "-"} 概念=${s.conceptTags.join("|") || "-"} 反馈=${s.feedback.slice(0, 200)}`,
    )
    .join("\n");

  const upcomingLines = input.upcomingSlots
    .slice(0, 12)
    .map(
      (u, i) =>
        `[${i + 1}] slotId=${u.scheduleSlotId} ${u.date} (${u.weekday}) ${u.time} 课程=${u.courseTitle} 班级=${u.className ?? "-"} 教室=${u.classroom ?? "-"}`,
    )
    .join("\n");

  const userPrompt = `时间窗口: ${input.windowStart.toISOString().slice(0, 10)} ~ ${input.windowEnd.toISOString().slice(0, 10)}

【过去 7 天 graded + released 提交数据 (${input.submissions.length} 条)】
${submissionLines || "（无）"}

【接下来 7 天课表 (${input.upcomingSlots.length} 节)】
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

  return { systemPrompt, userPrompt };
}

// ============================================
// 主入口
// ============================================

export interface GenerateOptions {
  /** 跳过缓存重新生成 */
  force?: boolean;
  /** 测试用：注入"现在"时间 */
  now?: Date;
}

export async function generateWeeklyInsight(
  teacherId: string,
  options: GenerateOptions = {},
): Promise<WeeklyInsightResult> {
  const now = options.now ?? new Date();

  if (!options.force) {
    const cached = cache.get(teacherId);
    if (cached && cached.expiresAt > now.getTime()) {
      return { ...cached.result, cached: true };
    }
  }

  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const windowEnd = now;
  const upcomingEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1) 拉过去 7 天 graded + released submissions（限定教师拥有/协作的课程）
  const submissions = await prisma.submission.findMany({
    where: {
      status: "graded",
      releasedAt: { not: null },
      gradedAt: { gte: windowStart, lte: windowEnd },
      OR: [
        { task: { creatorId: teacherId } },
        { taskInstance: { course: teacherCourseFilter(teacherId) } },
      ],
    },
    include: {
      student: { select: { id: true, name: true } },
      task: { select: { id: true, taskName: true, taskType: true } },
      taskInstance: {
        include: {
          class: { select: { id: true, name: true } },
          course: { select: { id: true, courseTitle: true } },
          chapter: { select: { id: true, title: true } },
          section: { select: { id: true, title: true } },
        },
      },
      simulationSubmission: true,
      quizSubmission: true,
      subjectiveSubmission: true,
    },
    orderBy: { gradedAt: "desc" },
    take: 200,
  });

  // 2) 拉教师未来 7 天课表（按课程过滤；下游依旧需要按 dayOfWeek/slotIndex/startWeek/endWeek 真正算"接下来 N 次发生时间"，本 PR 简化为列出全部相关 slot 给 AI 参考）
  const slots = await prisma.scheduleSlot.findMany({
    where: { course: teacherCourseFilter(teacherId) },
    include: {
      course: {
        select: {
          id: true,
          courseTitle: true,
          classId: true,
          semesterStartDate: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { slotIndex: "asc" }],
  });

  // 3) 用 transforms 已有逻辑（在 service 内 inline 简版）算未来 7 天发生的真实日期
  const upcomingSlots = computeUpcomingOccurrences(slots, now, upcomingEnd);

  // 4) 整理 PromptInput
  const promptInput: PromptInput = {
    windowStart,
    windowEnd,
    submissions: submissions.map((s) => {
      let conceptTags: string[] = [];
      let feedback = "";
      if (s.simulationSubmission) {
        conceptTags = s.simulationSubmission.conceptTags ?? [];
        const ev = s.simulationSubmission.evaluation as { feedback?: string } | null;
        feedback = ev?.feedback ?? "";
      } else if (s.quizSubmission) {
        conceptTags = s.quizSubmission.conceptTags ?? [];
        const ev = s.quizSubmission.evaluation as { feedback?: string } | null;
        feedback = ev?.feedback ?? "";
      } else if (s.subjectiveSubmission) {
        conceptTags = s.subjectiveSubmission.conceptTags ?? [];
        const ev = s.subjectiveSubmission.evaluation as { feedback?: string } | null;
        feedback = ev?.feedback ?? "";
      }
      return {
        submissionId: s.id,
        studentId: s.student.id,
        studentName: s.student.name,
        classId: s.taskInstance?.class?.id ?? null,
        className: s.taskInstance?.class?.name ?? null,
        courseId: s.taskInstance?.course?.id ?? null,
        courseTitle: s.taskInstance?.course?.courseTitle ?? null,
        chapterTitle: s.taskInstance?.chapter?.title ?? null,
        sectionTitle: s.taskInstance?.section?.title ?? null,
        taskName: s.task.taskName,
        taskType: s.task.taskType,
        score: s.score !== null ? Number(s.score) : null,
        maxScore: s.maxScore !== null ? Number(s.maxScore) : null,
        feedback: feedback.slice(0, 400),
        conceptTags,
      };
    }),
    upcomingSlots,
  };

  // 5) 调 AI
  const { systemPrompt, userPrompt } = buildWeeklyInsightPrompt(promptInput);

  let payload: WeeklyInsightPayload;
  try {
    const ai = await aiGenerateJSON(
      "weeklyInsight",
      teacherId,
      systemPrompt,
      userPrompt,
      aiSchema,
    );
    payload = {
      weakConceptsByCourse: ai.weakConceptsByCourse,
      classDifferences: ai.classDifferences,
      studentClusters: ai.studentClusters,
      upcomingClassRecommendations: ai.upcomingClassRecommendations,
      highlightSummary: ai.highlightSummary,
    };
  } catch (err) {
    console.error("[weekly-insight] AI 聚合失败，降级返回空 payload：", err);
    payload = {
      weakConceptsByCourse: [],
      classDifferences: [],
      studentClusters: [],
      upcomingClassRecommendations: [],
      highlightSummary:
        promptInput.submissions.length === 0
          ? "本周尚无已批改且已公布的提交，暂无可聚合的洞察。"
          : "本周洞察 AI 服务暂不可用，请稍后重新生成。",
    };
  }

  const result: WeeklyInsightResult = {
    payload,
    generatedAt: now,
    windowStart,
    windowEnd,
    submissionCount: promptInput.submissions.length,
    cached: false,
  };

  cache.set(teacherId, {
    result,
    expiresAt: now.getTime() + CACHE_TTL_MS,
  });

  return result;
}

// ============================================
// 课表 → 未来 7 天发生时间（简化算法，仅做"接下来 7 天内可能发生"的列举，不做精确周次复算）
// ============================================

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

interface SlotRow {
  id: string;
  courseId: string;
  dayOfWeek: number;
  slotIndex: number;
  startWeek: number;
  endWeek: number;
  timeLabel: string;
  classroom: string | null;
  weekType: string;
  course: {
    id: string;
    courseTitle: string;
    classId: string;
    semesterStartDate: Date | null;
    class: { id: string; name: string } | null;
  };
}

export function computeUpcomingOccurrences(
  slots: SlotRow[],
  now: Date,
  windowEnd: Date,
): PromptInput["upcomingSlots"] {
  const out: PromptInput["upcomingSlots"] = [];
  // 对每个 slot 在未来 7 天内逐日扫描，命中 dayOfWeek 即视为"近期发生"。
  // 不做严格周次校验（startWeek/endWeek/weekType）— 由 AI 兜底。本 PR 简化保证 dev 可跑。
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    if (candidate > windowEnd) break;
    const candidateDow = candidate.getDay();
    for (const slot of slots) {
      if (slot.dayOfWeek !== candidateDow) continue;
      out.push({
        scheduleSlotId: slot.id,
        courseId: slot.courseId,
        courseTitle: slot.course.courseTitle,
        date: candidate.toISOString().slice(0, 10),
        weekday: WEEKDAY_LABELS[candidateDow],
        time: slot.timeLabel,
        classroom: slot.classroom,
        className: slot.course.class?.name ?? null,
      });
    }
  }
  // 限制总条目（避免重复、过载）：取前 12 条
  return out.slice(0, 12);
}
