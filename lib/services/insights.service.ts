import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { aiGenerateJSON } from "./ai.service";

/**
 * Insights aggregation service.
 *
 * Reads all submissions for a task instance, harvests their AI-extracted
 * conceptTags + evaluation summaries, and asks an LLM (qwen-max via the
 * AI_INSIGHTS_MODEL env) to produce a class-level summary:
 *  - common issues (3-5 bullet points)
 *  - highlights (notable student answers)
 *  - weakness concepts (concept tag → student count)
 *
 * Result is cached on AnalysisReport.commonIssues + aggregatedAt. The teacher
 * triggers aggregation manually (button), so we only spend AI tokens on demand.
 */

export interface AggregatedInsights {
  commonIssues: Array<{
    title: string;
    description: string;
    studentCount: number;
  }>;
  highlights: Array<{
    submissionId: string;
    studentName: string;
    quote: string;
  }>;
  weaknessConcepts: Array<{
    tag: string;
    count: number;
  }>;
}

export interface AggregateInsightsResult {
  commonIssues: AggregatedInsights;
  aggregatedAt: Date;
  studentCount: number;
  reportId: string;
}

const aggregateSchema = z.object({
  commonIssues: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      studentCount: z.number(),
    })
  ),
  highlights: z.array(
    z.object({
      submissionId: z.string(),
      studentName: z.string(),
      quote: z.string(),
    })
  ),
});

/**
 * Get cached insights without triggering AI (fast read).
 * Returns null if no AnalysisReport exists yet for this instance/teacher.
 */
export async function getCachedInsights(
  instanceId: string,
  teacherId: string
): Promise<AggregateInsightsResult | null> {
  const report = await prisma.analysisReport.findFirst({
    where: { taskInstanceId: instanceId, createdBy: teacherId },
    orderBy: { createdAt: "desc" },
  });
  if (!report || !report.commonIssues || !report.aggregatedAt) return null;

  return {
    commonIssues: report.commonIssues as unknown as AggregatedInsights,
    aggregatedAt: report.aggregatedAt,
    studentCount: report.studentCount,
    reportId: report.id,
  };
}

/**
 * Trigger AI aggregation. Reads graded submissions + conceptTags, calls
 * qwen-max (AI_INSIGHTS_MODEL), persists to AnalysisReport.
 *
 * Throws:
 *  - NO_GRADED_SUBMISSIONS — when no submission is in 'graded' status
 *  - NO_CONCEPT_TAGS — when no submission has any conceptTags (caller should
 *    surface as "请先批改至少 1 份带概念标签的提交")
 *  - INSTANCE_NOT_FOUND — when instance does not exist
 */
export async function aggregateInsights(
  instanceId: string,
  teacherId: string
): Promise<AggregateInsightsResult> {
  const instance = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, taskId: true, title: true, taskType: true },
  });
  if (!instance) throw new Error("INSTANCE_NOT_FOUND");

  const submissions = await prisma.submission.findMany({
    where: { taskInstanceId: instanceId, status: "graded" },
    include: {
      student: { select: { id: true, name: true } },
      simulationSubmission: true,
      quizSubmission: true,
      subjectiveSubmission: true,
    },
    orderBy: { gradedAt: "desc" },
    take: 200,
  });

  if (submissions.length === 0) throw new Error("NO_GRADED_SUBMISSIONS");

  type EvaluationSummary = {
    submissionId: string;
    studentId: string;
    studentName: string;
    score: number | null;
    feedback: string;
    conceptTags: string[];
  };

  const evaluations: EvaluationSummary[] = [];
  for (const s of submissions) {
    let conceptTags: string[] = [];
    let feedback = "";
    if (s.simulationSubmission) {
      conceptTags = s.simulationSubmission.conceptTags || [];
      const ev = s.simulationSubmission.evaluation as
        | { feedback?: string }
        | null;
      feedback = ev?.feedback || "";
    } else if (s.quizSubmission) {
      conceptTags = s.quizSubmission.conceptTags || [];
      const ev = s.quizSubmission.evaluation as { feedback?: string } | null;
      feedback = ev?.feedback || "";
    } else if (s.subjectiveSubmission) {
      conceptTags = s.subjectiveSubmission.conceptTags || [];
      const ev = s.subjectiveSubmission.evaluation as
        | { feedback?: string }
        | null;
      feedback = ev?.feedback || "";
    }

    evaluations.push({
      submissionId: s.id,
      studentId: s.student.id,
      studentName: s.student.name,
      score: s.score !== null ? Number(s.score) : null,
      feedback: feedback.slice(0, 400),
      conceptTags,
    });
  }

  const totalTags = evaluations.reduce(
    (sum, e) => sum + e.conceptTags.length,
    0
  );
  if (totalTags === 0) throw new Error("NO_CONCEPT_TAGS");

  // Concept count map (deterministic; no AI needed for this part)
  const tagCounts = new Map<string, Set<string>>();
  for (const e of evaluations) {
    for (const tag of e.conceptTags) {
      const key = tag.trim();
      if (!key) continue;
      if (!tagCounts.has(key)) tagCounts.set(key, new Set());
      tagCounts.get(key)!.add(e.studentId);
    }
  }
  const weaknessConcepts = Array.from(tagCounts.entries())
    .map(([tag, studentSet]) => ({ tag, count: studentSet.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // AI: produce common issues + highlights from feedback corpus
  const systemPrompt = `你是一位资深的金融教育课程顾问。基于一组学生提交的 AI 批改反馈，归纳：
1. 全班共性问题（3-5 条），每条包含 title / description / 涉及学生估算数（studentCount）
2. 亮点提交（最多 3 条），每条引用一份提交的学生名字 + 简短引用 (quote ≤80 字)

输出严格 JSON。不要捏造数据 — 仅基于提供的反馈文本归纳。`;

  const corpus = evaluations
    .slice(0, 50)
    .map(
      (e, i) =>
        `[${i + 1}] submissionId=${e.submissionId} studentName=${e.studentName} score=${e.score} feedback=${e.feedback}`
    )
    .join("\n");

  const userPrompt = `任务: ${instance.title}（${instance.taskType}）
学生数: ${evaluations.length}

学生反馈片段:
${corpus}

请输出 JSON:
{
  "commonIssues": [
    {"title": "标题", "description": "描述", "studentCount": 数字}
  ],
  "highlights": [
    {"submissionId": "id", "studentName": "姓名", "quote": "引用"}
  ]
}`;

  const ai = await aiGenerateJSON(
    "insights",
    teacherId,
    systemPrompt,
    userPrompt,
    aggregateSchema
  );

  const aggregated: AggregatedInsights = {
    commonIssues: ai.commonIssues.slice(0, 5),
    highlights: ai.highlights.slice(0, 3),
    weaknessConcepts,
  };

  // Persist (upsert by instanceId+teacher: keep one row per teacher per instance)
  const existing = await prisma.analysisReport.findFirst({
    where: { taskInstanceId: instanceId, createdBy: teacherId },
  });
  const aggregatedAt = new Date();
  let saved;
  if (existing) {
    saved = await prisma.analysisReport.update({
      where: { id: existing.id },
      data: {
        studentCount: evaluations.length,
        commonIssues: aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
        aggregatedAt,
        report: aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
  } else {
    saved = await prisma.analysisReport.create({
      data: {
        taskInstanceId: instanceId,
        taskId: instance.taskId,
        createdBy: teacherId,
        studentCount: evaluations.length,
        report: aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
        commonIssues:
          aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
        aggregatedAt,
      },
    });
  }

  return {
    commonIssues: aggregated,
    aggregatedAt,
    studentCount: evaluations.length,
    reportId: saved.id,
  };
}
