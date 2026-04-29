import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { aiGenerateJSON } from "./ai.service";

/**
 * PR-7B: legacy mood enum keys → 0-1 score fallback for transcripts that have
 * `mood: "ANGRY"` but no `moodScore`. Mid-band guess for each archetype.
 */
function moodKeyToScoreFallback(label?: string): number {
  switch (label) {
    case "HAPPY": return 0.05;
    case "RELAXED": return 0.18;
    case "EXCITED": return 0.10;
    case "NEUTRAL": return 0.32;
    case "SKEPTICAL": return 0.48;
    case "CONFUSED": return 0.62;
    case "ANGRY": return 0.78;
    case "DISAPPOINTED": return 0.92;
    default: return 0.30;
  }
}

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

export interface AllocationSnapshotEntry {
  studentId: string;
  studentName: string;
  submissionId: string;
  /** Final allocations submitted (flat label/value pairs across all sections) */
  finalAllocations: Array<{ label: string; value: number }>;
  /** Chronological snapshots taken via "记录当前配比" during the simulation */
  snapshots: Array<{
    turn: number;
    ts: string;
    allocations: Array<{ label: string; value: number }>;
  }>;
}

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
  /** PR-7C: per-student allocation evolution. Empty array for non-simulation aggregations. */
  allocationSnapshots?: AllocationSnapshotEntry[];
}

export interface AggregateInsightsResult {
  commonIssues: AggregatedInsights;
  aggregatedAt: Date;
  studentCount: number;
  reportId: string;
  /** PR-7B: number of students whose simulation transcripts contained mood data (for QA visibility) */
  moodTimelineCount?: number;
  /** PR-7C: number of students whose sim submissions had at least 1 allocation snapshot */
  allocationSnapshotsCount?: number;
}

// PR-FIX-2 B3: arrays 加 .default([]) 防 AI 输出 missing field 时 zod 解析失败
const aggregateSchema = z.object({
  commonIssues: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        studentCount: z.number(),
      }),
    )
    .default([]),
  highlights: z
    .array(
      z.object({
        submissionId: z.string(),
        studentName: z.string(),
        quote: z.string(),
      }),
    )
    .default([]),
});

/**
 * Get cached insights without triggering AI (fast read).
 * Returns null if no AnalysisReport exists yet for this instance/teacher.
 */
export async function getCachedInsights(
  instanceId: string,
  teacherId: string
): Promise<AggregateInsightsResult | null> {
  void teacherId;
  // Cache is shared across all teachers/admins authorized to view this instance.
  // createdBy is kept as audit metadata (last trigger) but is not part of the lookup
  // key — otherwise teacher B would re-trigger AI aggregation already done by teacher A
  // for the same submissions, wasting tokens and producing inconsistent timestamps.
  // PR-FIX-2 B6: 使用 findUnique（schema 加了 @unique([taskInstanceId])，单 row per instance）
  const report = await prisma.analysisReport.findUnique({
    where: { taskInstanceId: instanceId },
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

  // PR-7B: per-student mood trajectory from simulation transcripts.
  type MoodTimelineEntry = {
    studentId: string;
    studentName: string;
    submissionId: string;
    /** Array indexed by AI-turn number (1-based). null entries are turns w/o mood data. */
    points: Array<{
      turn: number;
      score: number;
      label: string | null;
      hint: string | null;
    }>;
  };
  const moodTimeline: MoodTimelineEntry[] = [];
  // PR-7C: per-student allocation snapshot collection from simulationSubmission.assets
  const allocationSnapshots: AllocationSnapshotEntry[] = [];

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

      // PR-7C: harvest allocation snapshots from assets payload (if any).
      const assets = s.simulationSubmission.assets as
        | {
            sections?: Array<{
              label?: string;
              items?: Array<{ label?: string; value?: number }>;
            }>;
            snapshots?: Array<{
              turn?: number;
              ts?: string;
              allocations?: Array<{ label?: string; value?: number }>;
            }>;
          }
        | null;
      if (assets) {
        const finalAllocs: Array<{ label: string; value: number }> = [];
        for (const sec of assets.sections ?? []) {
          for (const it of sec.items ?? []) {
            if (typeof it.label === "string" && typeof it.value === "number") {
              finalAllocs.push({ label: it.label, value: it.value });
            }
          }
        }
        const cleanSnaps: AllocationSnapshotEntry["snapshots"] = [];
        for (const snap of assets.snapshots ?? []) {
          if (
            typeof snap.turn === "number" &&
            typeof snap.ts === "string" &&
            Array.isArray(snap.allocations)
          ) {
            const allocs: Array<{ label: string; value: number }> = [];
            for (const a of snap.allocations) {
              if (typeof a.label === "string" && typeof a.value === "number") {
                allocs.push({ label: a.label, value: a.value });
              }
            }
            cleanSnaps.push({ turn: snap.turn, ts: snap.ts, allocations: allocs });
          }
        }
        if (finalAllocs.length > 0 || cleanSnaps.length > 0) {
          allocationSnapshots.push({
            studentId: s.student.id,
            studentName: s.student.name,
            submissionId: s.id,
            finalAllocations: finalAllocs,
            snapshots: cleanSnaps,
          });
        }
      }

      // Walk transcript and extract mood timeline (AI turns only).
      const transcript = s.simulationSubmission.transcript as
        | Array<{
            role?: string;
            mood?: string;
            moodScore?: number;
            hint?: string;
          }>
        | null;
      if (Array.isArray(transcript)) {
        const points: MoodTimelineEntry["points"] = [];
        let aiTurn = 0;
        for (const m of transcript) {
          if (m && m.role === "ai") {
            aiTurn++;
            if (
              typeof m.moodScore === "number" ||
              typeof m.mood === "string" ||
              typeof m.hint === "string"
            ) {
              points.push({
                turn: aiTurn,
                score:
                  typeof m.moodScore === "number"
                    ? m.moodScore
                    : moodKeyToScoreFallback(m.mood),
                label: typeof m.mood === "string" ? m.mood : null,
                hint: typeof m.hint === "string" ? m.hint : null,
              });
            }
          }
        }
        if (points.length > 0) {
          moodTimeline.push({
            studentId: s.student.id,
            studentName: s.student.name,
            submissionId: s.id,
            points,
          });
        }
      }
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

  // PR-FIX-3 C5: 不抛 NO_CONCEPT_TAGS（之前 quiz 不写 conceptTags 整批就 fail）。
  // 改为：所有 submission 都无 conceptTags 时，weaknessConcepts 为空数组，
  // 仍跑 AI 聚合 commonIssues/highlights。让聚合在 conceptTags 缺失场景仍可降级运行。
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

  // PR-FIX-2 B3: AI 失败时仍保存 weaknessConcepts + 空 issues/highlights（降级路径，不丢历史 conceptTags 信息）
  let ai: { commonIssues: Array<{ title: string; description: string; studentCount: number }>; highlights: Array<{ submissionId: string; studentName: string; quote: string }> };
  try {
    ai = await aiGenerateJSON(
      "insights",
      teacherId,
      systemPrompt,
      userPrompt,
      aggregateSchema
    );
  } catch (err) {
    console.error("[insights] AI 聚合失败，降级写空 issues/highlights：", err);
    ai = { commonIssues: [], highlights: [] };
  }

  const aggregated: AggregatedInsights = {
    commonIssues: ai.commonIssues.slice(0, 5),
    highlights: ai.highlights.slice(0, 3),
    weaknessConcepts,
    ...(allocationSnapshots.length > 0
      ? { allocationSnapshots }
      : {}),
  };

  // PR-7B: include moodTimeline (only meaningful for simulation tasks; empty array OK).
  // Prisma requires Prisma.DbNull sentinel (not raw null) when clearing a nullable Json column.
  const moodTimelineJson:
    | import("@prisma/client").Prisma.InputJsonValue
    | typeof Prisma.DbNull =
    moodTimeline.length > 0
      ? (moodTimeline as unknown as import("@prisma/client").Prisma.InputJsonValue)
      : Prisma.DbNull;

  // PR-FIX-2 B6: 使用 prisma.analysisReport.upsert 替代 findFirst+if-else create/update。
  // schema 加 @unique([taskInstanceId])，one-row-per-instance 由 DB 保证（防并发重复 cache）。
  // createdBy 反映最新触发者（仅 audit 用，不参与查询 key）。
  const aggregatedAt = new Date();
  const saved = await prisma.analysisReport.upsert({
    where: { taskInstanceId: instanceId },
    create: {
      taskInstanceId: instanceId,
      taskId: instance.taskId,
      createdBy: teacherId,
      studentCount: evaluations.length,
      report: aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
      commonIssues:
        aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
      aggregatedAt,
      moodTimeline: moodTimelineJson,
    },
    update: {
      createdBy: teacherId,
      studentCount: evaluations.length,
      commonIssues: aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
      aggregatedAt,
      report: aggregated as unknown as import("@prisma/client").Prisma.InputJsonValue,
      moodTimeline: moodTimelineJson,
    },
  });

  return {
    commonIssues: aggregated,
    aggregatedAt,
    studentCount: evaluations.length,
    reportId: saved.id,
    moodTimelineCount: moodTimeline.length,
    allocationSnapshotsCount: allocationSnapshots.length,
  };
}
