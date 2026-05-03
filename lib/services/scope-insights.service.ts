import { createHash } from "crypto";
import { z } from "zod";
import type { Prisma, TaskType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "./ai.service";

export interface ScopeKey {
  courseId: string;
  chapterId?: string;
  sectionId?: string;
  classIds?: string[];
  taskType?: TaskType;
  taskInstanceId?: string;
}

export interface TranscriptExcerpt {
  role: "student" | "assistant" | "ai";
  content: string;
  mood?: string | null;
}

export interface ScopeSimulationHighlight {
  studentId: string;
  studentName: string;
  submissionId: string;
  taskInstanceId: string;
  taskTitle: string;
  score: number;
  maxScore: number;
  normalizedScore: number;
  transcript: TranscriptExcerpt[];
  reason: string;
}

export interface ScopeSimulationIssueEvidence {
  studentId: string;
  studentName: string;
  submissionId: string;
  taskInstanceId: string;
  transcriptExcerpt: string;
  rubricCriterion: string;
  score: number;
}

export interface ScopeSimulationIssue {
  title: string;
  description: string;
  frequency: number;
  relatedCriterion: string;
  evidence: ScopeSimulationIssueEvidence[];
}

export interface ScopeSimulationInsight {
  scope: ScopeKey;
  generatedAt: string;
  highlights: ScopeSimulationHighlight[];
  commonIssues: ScopeSimulationIssue[];
  source: "cache" | "fresh" | "fallback";
  staleAt?: string;
  notice?: string;
}

export interface ScopeStudyBuddyQuestion {
  text: string;
  count: number;
  studentSampleIds: string[];
  studentSampleNames: string[];
}

export interface ScopeStudyBuddySectionGroup {
  sectionId: string | null;
  chapterId: string | null;
  sectionLabel: string;
  topQuestions: ScopeStudyBuddyQuestion[];
}

export interface ScopeStudyBuddySummary {
  scope: ScopeKey;
  generatedAt: string;
  bySection: ScopeStudyBuddySectionGroup[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HIGHLIGHTS_TARGET = 4;
const HIGHLIGHTS_PER_TASK_CAP = 2;
const TRANSCRIPT_MAX_PER_HIGHLIGHT = 3;
const ISSUE_LOW_SCORE_THRESHOLD = 0.6;
const ISSUE_TOP_K = 3;
const ISSUE_EVIDENCE_PER_ISSUE = 5;

const POSITIVE_MOODS = new Set(["positive", "happy", "satisfied", "interested", "excited", "calm"]);

export function computeScopeHash(scope: ScopeKey): string {
  const normalized = {
    courseId: scope.courseId,
    chapterId: scope.chapterId ?? null,
    sectionId: scope.sectionId ?? null,
    classIds: scope.classIds && scope.classIds.length > 0 ? [...scope.classIds].sort() : null,
    taskType: scope.taskType ?? null,
    taskInstanceId: scope.taskInstanceId ?? null,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function getScopeSimulationInsights(
  scope: ScopeKey,
  options?: { forceFresh?: boolean; teacherId?: string },
): Promise<ScopeSimulationInsight> {
  const scopeHash = computeScopeHash(scope);
  const now = new Date();
  const cacheCutoff = new Date(now.getTime() - CACHE_TTL_MS);

  if (!options?.forceFresh) {
    const cached = await prisma.analysisReport.findFirst({
      where: { scopeHash, createdAt: { gt: cacheCutoff } },
      orderBy: { createdAt: "desc" },
      select: { scopeSummary: true, createdAt: true },
    });
    if (cached?.scopeSummary) {
      const parsed = parseCachedScopeSummary(cached.scopeSummary);
      if (parsed) {
        return {
          ...parsed,
          scope,
          source: "cache",
          staleAt: new Date(cached.createdAt.getTime() + CACHE_TTL_MS).toISOString(),
        };
      }
    }
  }

  const fresh = await buildScopeSimulationInsightFresh(scope, now, options?.teacherId);

  await prisma.analysisReport.create({
    data: {
      scopeHash,
      scopeSummary: serializeScopeSummary(fresh) as unknown as Prisma.InputJsonValue,
      createdBy: options?.teacherId ?? "system",
      studentCount: fresh.highlights.length,
      report: { kind: "scope_simulation_insight" } as Prisma.InputJsonValue,
    },
  });

  return {
    ...fresh,
    staleAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  };
}

export async function getScopeStudyBuddySummary(scope: ScopeKey): Promise<ScopeStudyBuddySummary> {
  const generatedAt = new Date().toISOString();

  const instanceWhere = buildInstanceWhere(scope);
  const instances = await prisma.taskInstance.findMany({
    where: instanceWhere,
    select: {
      taskId: true,
      chapterId: true,
      sectionId: true,
      chapter: { select: { id: true, title: true, order: true } },
      section: { select: { id: true, title: true, order: true } },
    },
  });

  if (instances.length === 0) {
    return { scope, generatedAt, bySection: [] };
  }

  const taskIds = Array.from(new Set(instances.map((i) => i.taskId)));
  const taskToSection = new Map<
    string,
    { sectionId: string | null; chapterId: string | null; sectionLabel: string }
  >();
  for (const inst of instances) {
    if (taskToSection.has(inst.taskId)) continue;
    taskToSection.set(inst.taskId, {
      sectionId: inst.sectionId,
      chapterId: inst.chapterId,
      sectionLabel: buildSectionLabel(inst.chapter, inst.section),
    });
  }

  const summaries = await prisma.studyBuddySummary.findMany({
    where: { taskId: { in: taskIds } },
    orderBy: { generatedAt: "desc" },
    select: { taskId: true, topQuestions: true },
  });

  const dedupByTask = new Map<string, unknown>();
  for (const row of summaries) {
    if (!dedupByTask.has(row.taskId)) dedupByTask.set(row.taskId, row.topQuestions);
  }

  const taskIdsForPosts = Array.from(dedupByTask.keys());
  const studentLookupTaskIds = taskIdsForPosts.length > 0 ? taskIdsForPosts : taskIds;
  const samplePosts = studentLookupTaskIds.length > 0
    ? await prisma.studyBuddyPost.findMany({
        where: { taskId: { in: studentLookupTaskIds }, isPreview: false },
        select: { taskId: true, studentId: true, question: true, student: { select: { name: true } } },
        take: 600,
      })
    : [];

  const sectionGroups = new Map<string, ScopeStudyBuddySectionGroup>();
  for (const [taskId, topQuestionsRaw] of dedupByTask.entries()) {
    const sectionInfo = taskToSection.get(taskId);
    if (!sectionInfo) continue;
    const sectionKey = sectionInfo.sectionId ?? "__null_section__";
    if (!sectionGroups.has(sectionKey)) {
      sectionGroups.set(sectionKey, {
        sectionId: sectionInfo.sectionId,
        chapterId: sectionInfo.chapterId,
        sectionLabel: sectionInfo.sectionLabel,
        topQuestions: [],
      });
    }
    const group = sectionGroups.get(sectionKey)!;
    const topQuestions = parseTopQuestions(topQuestionsRaw);
    for (const q of topQuestions) {
      const taskPosts = samplePosts.filter((p) => p.taskId === taskId);
      const matched = taskPosts
        .filter((p) => p.question.includes(q.text) || q.text.includes(p.question.slice(0, 8)))
        .slice(0, 5);
      group.topQuestions.push({
        text: q.text,
        count: q.count,
        studentSampleIds: matched.map((p) => p.studentId),
        studentSampleNames: Array.from(new Set(matched.map((p) => p.student?.name ?? "匿名学生"))).slice(0, 5),
      });
    }
  }

  const bySection: ScopeStudyBuddySectionGroup[] = Array.from(sectionGroups.values())
    .map((group) => ({
      ...group,
      topQuestions: group.topQuestions
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "zh-CN"))
        .slice(0, 5),
    }))
    .filter((group) => group.topQuestions.length > 0)
    .sort((a, b) => a.sectionLabel.localeCompare(b.sectionLabel, "zh-CN"));

  return { scope, generatedAt, bySection };
}

function buildInstanceWhere(scope: ScopeKey): Prisma.TaskInstanceWhereInput {
  return {
    courseId: scope.courseId,
    status: { not: "draft" },
    ...(scope.chapterId && { chapterId: scope.chapterId }),
    ...(scope.sectionId && { sectionId: scope.sectionId }),
    ...(scope.classIds && scope.classIds.length > 0 ? { classId: { in: scope.classIds } } : {}),
    ...(scope.taskType && { taskType: scope.taskType }),
    ...(scope.taskInstanceId && { id: scope.taskInstanceId }),
  };
}

function buildSectionLabel(
  chapter: { title: string; order: number } | null,
  section: { title: string; order: number } | null,
): string {
  const chapterLabel = chapter ? `第 ${chapter.order} 章 ${chapter.title}` : "未关联章节";
  const sectionLabel = section ? ` · ${section.order}. ${section.title}` : section === null && chapter ? "" : "";
  return chapterLabel + sectionLabel;
}

function parseTopQuestions(raw: unknown): Array<{ text: string; count: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ text: string; count: number }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const text = typeof r.question === "string" ? r.question : typeof r.text === "string" ? r.text : null;
    const count = typeof r.count === "number" ? r.count : 1;
    if (text) out.push({ text, count });
  }
  return out;
}

async function buildScopeSimulationInsightFresh(
  scope: ScopeKey,
  now: Date,
  teacherId: string | undefined,
): Promise<ScopeSimulationInsight> {
  const instanceWhere: Prisma.TaskInstanceWhereInput = {
    ...buildInstanceWhere(scope),
    taskType: "simulation",
  };
  const instances = await prisma.taskInstance.findMany({
    where: instanceWhere,
    select: { id: true, title: true },
  });
  const instanceIds = instances.map((i) => i.id);
  const instanceTitleById = new Map(instances.map((i) => [i.id, i.title]));

  if (instanceIds.length === 0) {
    return {
      scope,
      generatedAt: now.toISOString(),
      highlights: [],
      commonIssues: [],
      source: "fresh",
    };
  }

  const submissions = await prisma.submission.findMany({
    where: {
      taskInstanceId: { in: instanceIds },
      taskType: "simulation",
      status: "graded",
    },
    select: {
      id: true,
      studentId: true,
      taskInstanceId: true,
      score: true,
      maxScore: true,
      student: { select: { id: true, name: true } },
      simulationSubmission: { select: { transcript: true, evaluation: true } },
    },
  });

  if (submissions.length === 0) {
    return {
      scope,
      generatedAt: now.toISOString(),
      highlights: [],
      commonIssues: [],
      source: "fresh",
    };
  }

  type ScoredRow = {
    submissionId: string;
    studentId: string;
    studentName: string;
    taskInstanceId: string;
    taskTitle: string;
    score: number;
    maxScore: number;
    normalizedScore: number;
    transcript: TranscriptExcerpt[];
    rubric: Array<{ criterionId: string; criterionName: string; score: number; maxScore: number; comment: string | null }>;
  };
  const scored: ScoredRow[] = [];

  for (const s of submissions) {
    if (s.taskInstanceId === null) continue;
    const taskInstanceId = s.taskInstanceId;
    const score = s.score === null ? null : Number(s.score);
    const maxScore = s.maxScore === null ? null : Number(s.maxScore);
    if (score === null || maxScore === null || maxScore <= 0) continue;
    const normalized = (score / maxScore) * 100;
    const transcript = extractStudentTranscript(s.simulationSubmission?.transcript);
    const rubric = extractRubricBreakdown(s.simulationSubmission?.evaluation);
    scored.push({
      submissionId: s.id,
      studentId: s.studentId,
      studentName: s.student.name,
      taskInstanceId,
      taskTitle: instanceTitleById.get(taskInstanceId) ?? "未命名任务",
      score,
      maxScore,
      normalizedScore: Math.round(normalized * 10) / 10,
      transcript,
      rubric,
    });
  }

  const highlights = pickHighlights(scored);
  const commonIssues = await pickCommonIssues(scored, teacherId);

  return {
    scope,
    generatedAt: now.toISOString(),
    highlights,
    commonIssues: commonIssues.issues,
    source: commonIssues.fellBack ? "fallback" : "fresh",
    notice: commonIssues.fellBack ? commonIssues.notice : undefined,
  };
}

function pickHighlights(scored: Array<{
  submissionId: string;
  studentId: string;
  studentName: string;
  taskInstanceId: string;
  taskTitle: string;
  score: number;
  maxScore: number;
  normalizedScore: number;
  transcript: TranscriptExcerpt[];
}>): ScopeSimulationHighlight[] {
  const sorted = [...scored].sort((a, b) => b.normalizedScore - a.normalizedScore);
  const perTaskCount = new Map<string, number>();
  const out: ScopeSimulationHighlight[] = [];
  for (const row of sorted) {
    if (out.length >= HIGHLIGHTS_TARGET) break;
    const used = perTaskCount.get(row.taskInstanceId) ?? 0;
    if (used >= HIGHLIGHTS_PER_TASK_CAP) continue;
    perTaskCount.set(row.taskInstanceId, used + 1);
    out.push({
      studentId: row.studentId,
      studentName: row.studentName,
      submissionId: row.submissionId,
      taskInstanceId: row.taskInstanceId,
      taskTitle: row.taskTitle,
      score: row.score,
      maxScore: row.maxScore,
      normalizedScore: row.normalizedScore,
      transcript: row.transcript.slice(0, TRANSCRIPT_MAX_PER_HIGHLIGHT),
      reason: `${row.studentName} 在「${row.taskTitle}」中得分 ${row.score}/${row.maxScore}（${row.normalizedScore}%），对话亮点见证据。`,
    });
  }
  return out;
}

const ISSUE_FALLBACK_NOTICE = "AI 暂不可用或样本不足，已显示模板化提示。请稍后重试或扩大筛选范围。";

async function pickCommonIssues(
  scored: Array<{
    submissionId: string;
    studentId: string;
    studentName: string;
    taskInstanceId: string;
    taskTitle: string;
    transcript: TranscriptExcerpt[];
    rubric: Array<{ criterionId: string; criterionName: string; score: number; maxScore: number; comment: string | null }>;
  }>,
  teacherId: string | undefined,
): Promise<{ issues: ScopeSimulationIssue[]; fellBack: boolean; notice?: string }> {
  type LowItem = {
    criterionId: string;
    criterionName: string;
    studentId: string;
    studentName: string;
    submissionId: string;
    taskInstanceId: string;
    score: number;
    maxScore: number;
    comment: string | null;
    transcriptExcerpt: string;
  };
  const lowItems: LowItem[] = [];
  for (const row of scored) {
    for (const r of row.rubric) {
      if (r.maxScore <= 0) continue;
      if (r.score / r.maxScore >= ISSUE_LOW_SCORE_THRESHOLD) continue;
      lowItems.push({
        criterionId: r.criterionId,
        criterionName: r.criterionName,
        studentId: row.studentId,
        studentName: row.studentName,
        submissionId: row.submissionId,
        taskInstanceId: row.taskInstanceId,
        score: r.score,
        maxScore: r.maxScore,
        comment: r.comment,
        transcriptExcerpt: row.transcript[0]?.content?.slice(0, 200) ?? "",
      });
    }
  }

  if (lowItems.length === 0) {
    return {
      issues: [
        {
          title: "暂无低分维度",
          description: "当前范围内 simulation 评分均高于 60%，未发现共性低分问题。",
          frequency: 0,
          relatedCriterion: "—",
          evidence: [],
        },
      ],
      fellBack: true,
      notice: "样本中未出现得分率低于 60% 的评分维度。",
    };
  }

  const groupedByCriterion = new Map<string, LowItem[]>();
  for (const item of lowItems) {
    const arr = groupedByCriterion.get(item.criterionId) ?? [];
    arr.push(item);
    groupedByCriterion.set(item.criterionId, arr);
  }

  const topGroups = Array.from(groupedByCriterion.values())
    .sort((a, b) => b.length - a.length)
    .slice(0, ISSUE_TOP_K);

  if (!teacherId) {
    return {
      issues: topGroups.map((items) => ({
        title: `${items[0].criterionName} 维度需关注`,
        description: `该维度共 ${items.length} 个学生得分低于 60%，建议在课堂讲解或补充练习中加强。`,
        frequency: items.length,
        relatedCriterion: items[0].criterionName,
        evidence: items.slice(0, ISSUE_EVIDENCE_PER_ISSUE).map((item) => ({
          studentId: item.studentId,
          studentName: item.studentName,
          submissionId: item.submissionId,
          taskInstanceId: item.taskInstanceId,
          transcriptExcerpt: item.transcriptExcerpt,
          rubricCriterion: item.criterionName,
          score: Math.round((item.score / item.maxScore) * 100),
        })),
      })),
      fellBack: true,
      notice: "未提供教师 ID 以调用 AI 聚合，已显示启发式分组结果。",
    };
  }

  const llmInput = topGroups.map((items, idx) => ({
    index: idx + 1,
    criterion: items[0].criterionName,
    studentCount: items.length,
    samples: items.slice(0, ISSUE_EVIDENCE_PER_ISSUE).map((item) => ({
      studentName: item.studentName,
      score: Math.round((item.score / item.maxScore) * 100),
      comment: item.comment ?? "",
      transcriptExcerpt: item.transcriptExcerpt,
    })),
  }));

  const systemPrompt =
    "你是一位资深的教学诊断顾问。基于学生在 simulation 模拟对话中的低分维度样本，归纳 3-4 个共性问题。" +
    "每条 title ≤15 字，description ≤80 字，关联 criterion 必须复用输入中的名称，至少 2 个学生证据。" +
    "不要捏造数据，仅基于提供的样本归纳。";

  const userPrompt =
    `以下是 simulation 评分中得分率 < 60% 的样本（按 criterion 分组）：\n\n` +
    JSON.stringify(llmInput, null, 2) +
    `\n\n请输出 JSON: {"commonIssues": [{"title": "...", "description": "...", "frequency": 数字, "relatedCriterion": "...", "evidenceStudentNames": ["学生A", "学生B"]}]}`;

  const schema = z.object({
    commonIssues: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        frequency: z.number(),
        relatedCriterion: z.string(),
        evidenceStudentNames: z.array(z.string()),
      }),
    ),
  });

  try {
    const ai = await aiGenerateJSON("insights", teacherId, systemPrompt, userPrompt, schema, 1);
    const issues: ScopeSimulationIssue[] = ai.commonIssues.slice(0, 4).map((issue) => {
      const matchedItems = lowItems.filter(
        (item) =>
          item.criterionName === issue.relatedCriterion &&
          (issue.evidenceStudentNames.length === 0 || issue.evidenceStudentNames.includes(item.studentName)),
      );
      const evidenceItems = matchedItems.slice(0, ISSUE_EVIDENCE_PER_ISSUE);
      return {
        title: issue.title.slice(0, 30),
        description: issue.description.slice(0, 200),
        frequency: issue.frequency,
        relatedCriterion: issue.relatedCriterion,
        evidence: evidenceItems.map((item) => ({
          studentId: item.studentId,
          studentName: item.studentName,
          submissionId: item.submissionId,
          taskInstanceId: item.taskInstanceId,
          transcriptExcerpt: item.transcriptExcerpt,
          rubricCriterion: item.criterionName,
          score: Math.round((item.score / item.maxScore) * 100),
        })),
      };
    });
    return { issues, fellBack: false };
  } catch (err) {
    console.error("[scope-insights] AI commonIssues fallback:", err);
    return {
      issues: topGroups.map((items) => ({
        title: `${items[0].criterionName} 维度需关注`,
        description: `该维度共 ${items.length} 个学生得分低于 60%。AI 未生成具体描述，建议查看证据后人工归纳。`,
        frequency: items.length,
        relatedCriterion: items[0].criterionName,
        evidence: items.slice(0, ISSUE_EVIDENCE_PER_ISSUE).map((item) => ({
          studentId: item.studentId,
          studentName: item.studentName,
          submissionId: item.submissionId,
          taskInstanceId: item.taskInstanceId,
          transcriptExcerpt: item.transcriptExcerpt,
          rubricCriterion: item.criterionName,
          score: Math.round((item.score / item.maxScore) * 100),
        })),
      })),
      fellBack: true,
      notice: ISSUE_FALLBACK_NOTICE,
    };
  }
}

function extractStudentTranscript(raw: unknown): TranscriptExcerpt[] {
  if (!Array.isArray(raw)) return [];
  const out: TranscriptExcerpt[] = [];
  for (const turn of raw) {
    if (!turn || typeof turn !== "object") continue;
    const r = turn as Record<string, unknown>;
    const role = typeof r.role === "string" ? r.role : null;
    const rawContent = typeof r.content === "string" ? r.content : typeof r.text === "string" ? r.text : "";
    const content = rawContent.trim();
    if (!role || !content) continue;
    if (content.length < 15) continue;
    if (role !== "student" && role !== "user") continue;
    const moodRaw = typeof r.mood === "string" ? r.mood : null;
    if (out.length < TRANSCRIPT_MAX_PER_HIGHLIGHT * 2) {
      out.push({
        role: "student",
        content,
        ...(moodRaw ? { mood: moodRaw } : {}),
      });
    }
  }
  if (out.length > TRANSCRIPT_MAX_PER_HIGHLIGHT) {
    const positives = out.filter((t) => typeof t.mood === "string" && POSITIVE_MOODS.has(t.mood.toLowerCase()));
    if (positives.length >= TRANSCRIPT_MAX_PER_HIGHLIGHT) return positives.slice(0, TRANSCRIPT_MAX_PER_HIGHLIGHT);
  }
  return out.slice(0, TRANSCRIPT_MAX_PER_HIGHLIGHT);
}

function extractRubricBreakdown(
  raw: unknown,
): Array<{ criterionId: string; criterionName: string; score: number; maxScore: number; comment: string | null }> {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const breakdown = obj.rubricBreakdown;
  if (!Array.isArray(breakdown)) return [];
  const out: Array<{ criterionId: string; criterionName: string; score: number; maxScore: number; comment: string | null }> = [];
  for (const entry of breakdown) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const criterionId = typeof e.criterionId === "string" ? e.criterionId : null;
    if (!criterionId) continue;
    const criterionName =
      typeof e.criterionName === "string"
        ? e.criterionName
        : typeof e.name === "string"
          ? (e.name as string)
          : criterionId;
    const score = numericField(e.score);
    const maxScore = numericField(e.maxScore);
    if (score === null || maxScore === null) continue;
    out.push({
      criterionId,
      criterionName,
      score,
      maxScore,
      comment: typeof e.comment === "string" ? e.comment : null,
    });
  }
  return out;
}

function numericField(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function serializeScopeSummary(insight: ScopeSimulationInsight) {
  return {
    generatedAt: insight.generatedAt,
    highlights: insight.highlights,
    commonIssues: insight.commonIssues,
    source: insight.source,
    notice: insight.notice ?? null,
  };
}

function parseCachedScopeSummary(raw: unknown): Omit<ScopeSimulationInsight, "scope" | "source" | "staleAt"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.generatedAt !== "string") return null;
  if (!Array.isArray(r.highlights) || !Array.isArray(r.commonIssues)) return null;
  return {
    generatedAt: r.generatedAt,
    highlights: r.highlights as ScopeSimulationHighlight[],
    commonIssues: r.commonIssues as ScopeSimulationIssue[],
    notice: typeof r.notice === "string" ? r.notice : undefined,
  };
}
