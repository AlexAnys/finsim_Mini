import { createHash } from "crypto";
import { z } from "zod";
import type { Prisma, TaskType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "./ai.service";
import { isRiskChapter } from "./analytics-v2.service";

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

export interface AdviceKnowledgeGoal {
  point: string;
  evidence: string;
}

export interface AdvicePedagogyAdvice {
  method: string;
  evidence: string;
}

export interface AdviceFocusGroup {
  group: string;
  action: string;
  studentIds: string[];
  evidence: string;
}

export interface AdviceNextStep {
  step: string;
  evidence: string;
}

export interface ScopeTeachingAdvice {
  scope: ScopeKey;
  generatedAt: string;
  source: "fresh" | "cache" | "fallback";
  knowledgeGoals: AdviceKnowledgeGoal[];
  pedagogyAdvice: AdvicePedagogyAdvice[];
  focusGroups: AdviceFocusGroup[];
  nextSteps: AdviceNextStep[];
  notice?: string;
  staleAt?: string;
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
        const needsNameFix = parsed.commonIssues.some((issue) => isUuidString(issue.relatedCriterion));
        const fixed = needsNameFix
          ? await normalizeIssueCriterionNames(scope, parsed.commonIssues)
          : parsed.commonIssues;
        return {
          ...parsed,
          commonIssues: fixed,
          scope,
          source: "cache",
          staleAt: new Date(cached.createdAt.getTime() + CACHE_TTL_MS).toISOString(),
        };
      }
    }
  }

  const fresh = await buildScopeSimulationInsightFresh(scope, now, options?.teacherId);

  const existing = await prisma.analysisReport.findFirst({
    where: { scopeHash },
    orderBy: { createdAt: "desc" },
    select: { id: true, scopeSummary: true },
  });
  const previousScopeSummary =
    existing?.scopeSummary && typeof existing.scopeSummary === "object" && !Array.isArray(existing.scopeSummary)
      ? (existing.scopeSummary as Record<string, unknown>)
      : {};
  const mergedSummary = {
    ...previousScopeSummary,
    ...serializeScopeSummary(fresh),
  };
  if (existing) {
    await prisma.analysisReport.update({
      where: { id: existing.id },
      data: {
        scopeSummary: mergedSummary as unknown as Prisma.InputJsonValue,
        studentCount: fresh.highlights.length,
        createdAt: now,
      },
    });
  } else {
    await prisma.analysisReport.create({
      data: {
        scopeHash,
        scopeSummary: mergedSummary as unknown as Prisma.InputJsonValue,
        createdBy: options?.teacherId ?? "system",
        studentCount: fresh.highlights.length,
        report: { kind: "scope_simulation_insight" } as Prisma.InputJsonValue,
        createdAt: now,
      },
    });
  }

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

  const criterionNameMap = await loadCriterionNameMap(instanceIds);

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
    const rawRubric = extractRubricBreakdown(s.simulationSubmission?.evaluation);
    const rubric = rawRubric.map((r) => ({
      ...r,
      criterionName: resolveCriterionName(r.criterionId, r.criterionName, criterionNameMap),
    }));
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidString(value: unknown): boolean {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

async function loadCriterionNameMap(instanceIds: string[]): Promise<Map<string, string>> {
  if (instanceIds.length === 0) return new Map();
  const taskInstances = await prisma.taskInstance.findMany({
    where: { id: { in: instanceIds } },
    select: { taskId: true },
  });
  const taskIds = Array.from(new Set(taskInstances.map((t) => t.taskId)));
  if (taskIds.length === 0) return new Map();
  const criteria = await prisma.scoringCriterion.findMany({
    where: { taskId: { in: taskIds } },
    select: { id: true, name: true },
  });
  return new Map(criteria.map((c) => [c.id, c.name]));
}

function resolveCriterionName(
  criterionId: string,
  fallbackName: string,
  nameMap: Map<string, string>,
): string {
  const mapped = nameMap.get(criterionId);
  if (mapped) return mapped;
  if (isUuidString(fallbackName)) {
    const remapped = nameMap.get(fallbackName);
    if (remapped) return remapped;
  }
  return fallbackName;
}

async function normalizeIssueCriterionNames(
  scope: ScopeKey,
  issues: ScopeSimulationIssue[],
): Promise<ScopeSimulationIssue[]> {
  const instances = await prisma.taskInstance.findMany({
    where: { ...buildInstanceWhere(scope), taskType: "simulation" },
    select: { id: true },
  });
  const instanceIds = instances.map((i) => i.id);
  const nameMap = await loadCriterionNameMap(instanceIds);
  if (nameMap.size === 0) return issues;
  return issues.map((issue) => ({
    ...issue,
    relatedCriterion: nameMap.get(issue.relatedCriterion) ?? issue.relatedCriterion,
    evidence: issue.evidence.map((ev) => ({
      ...ev,
      rubricCriterion: nameMap.get(ev.rubricCriterion) ?? ev.rubricCriterion,
    })),
  }));
}

const TEACHING_ADVICE_FALLBACK_NOTICE = "AI 教学建议暂不可用，已显示规则模板。请稍后点击「重新生成」重试。";

export async function getScopeTeachingAdvice(
  scope: ScopeKey,
  options?: { forceFresh?: boolean; teacherId?: string },
): Promise<ScopeTeachingAdvice> {
  const scopeHash = computeScopeHash(scope);
  const now = new Date();
  const cacheCutoff = new Date(now.getTime() - CACHE_TTL_MS);

  if (!options?.forceFresh) {
    const cached = await prisma.analysisReport.findFirst({
      where: { scopeHash, createdAt: { gt: cacheCutoff } },
      orderBy: { createdAt: "desc" },
      select: { scopeSummary: true, createdAt: true },
    });
    const cachedAdvice = parseCachedTeachingAdvice(cached?.scopeSummary);
    if (cachedAdvice) {
      return {
        ...cachedAdvice,
        scope,
        source: "cache",
        staleAt: new Date(cached!.createdAt.getTime() + CACHE_TTL_MS).toISOString(),
      };
    }
  }

  const fresh = await buildScopeTeachingAdviceFresh(scope, now, options?.teacherId);
  await persistTeachingAdvice(scopeHash, fresh, options?.teacherId);
  return {
    ...fresh,
    staleAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  };
}

async function buildScopeTeachingAdviceFresh(
  scope: ScopeKey,
  now: Date,
  teacherId: string | undefined,
): Promise<ScopeTeachingAdvice> {
  const { getAnalyticsV2Diagnosis } = await import("./analytics-v2.service");
  const diagnosis = await getAnalyticsV2Diagnosis({
    courseId: scope.courseId,
    chapterId: scope.chapterId,
    sectionId: scope.sectionId,
    classIds: scope.classIds,
    taskType: scope.taskType,
    taskInstanceId: scope.taskInstanceId,
  });

  const [simulation, studyBuddy] = await Promise.all([
    getScopeSimulationInsights(scope, { teacherId }),
    getScopeStudyBuddySummary(scope),
  ]);

  const interventionsTop = [...diagnosis.studentInterventions]
    .sort((a, b) => {
      const reasonOrder = { not_submitted: 0, low_score: 1, declining: 2 } as const;
      const ra = reasonOrder[a.reason];
      const rb = reasonOrder[b.reason];
      if (ra !== rb) return ra - rb;
      const sa = a.selectedScore ?? Number.POSITIVE_INFINITY;
      const sb = b.selectedScore ?? Number.POSITIVE_INFINITY;
      return sa - sb;
    })
    .slice(0, 15);

  const riskChapters = diagnosis.chapterDiagnostics.filter(isRiskChapter);

  const promptInput = {
    scope: {
      courseTitle: diagnosis.scope.courseTitle,
      classCount: diagnosis.scope.classIds.length,
    },
    kpis: {
      completionRate: diagnosis.kpis.completionRate,
      avgNormalizedScore: diagnosis.kpis.avgNormalizedScore,
      pendingReleaseCount: diagnosis.kpis.pendingReleaseCount,
      riskChapterCount: riskChapters.length,
      riskStudentCount: new Set(diagnosis.studentInterventions.map((i) => i.studentId)).size,
      assignedStudents: diagnosis.kpis.assignedStudents,
      submittedStudents: diagnosis.kpis.submittedStudents,
      gradedStudents: diagnosis.kpis.gradedStudents,
    },
    commonIssues: simulation.commonIssues.slice(0, 3).map((issue) => ({
      title: issue.title,
      description: issue.description,
      relatedCriterion: issue.relatedCriterion,
      frequency: issue.frequency,
    })),
    studyBuddyTopQuestions: studyBuddy.bySection.slice(0, 3).map((sec) => ({
      section: sec.sectionLabel,
      questions: sec.topQuestions.slice(0, 3).map((q) => ({ text: q.text, count: q.count })),
    })),
    riskChapters: riskChapters.slice(0, 5).map((chapter) => ({
      title: chapter.title,
      completionRate: chapter.completionRate,
      avgNormalizedScore: chapter.avgNormalizedScore,
      instanceCount: chapter.instanceCount,
    })),
    studentInterventionsTop: interventionsTop.map((row) => ({
      name: row.studentName,
      class: row.className,
      reason: row.reason,
      score: row.selectedScore,
    })),
  };

  const fallback = buildFallbackAdvice(scope, now, diagnosis, riskChapters, interventionsTop);

  if (!teacherId) {
    return { ...fallback, notice: TEACHING_ADVICE_FALLBACK_NOTICE };
  }

  const adviceSchema = z.object({
    knowledgeGoals: z.array(z.object({ point: z.string(), evidence: z.string() })),
    pedagogyAdvice: z.array(z.object({ method: z.string(), evidence: z.string() })),
    focusGroups: z.array(
      z.object({
        group: z.string(),
        action: z.string(),
        studentNames: z.array(z.string()).optional().default([]),
        evidence: z.string(),
      }),
    ),
    nextSteps: z.array(z.object({ step: z.string(), evidence: z.string() })),
  });

  const systemPrompt =
    "你是高校金融教育的资深教学顾问。基于教师当前班级 / 课程的学情数据，给出本周教学建议。" +
    "每条 evidence 必须直接引用输入数据中的具体数字、学生名或章节名（不能笼统）。" +
    "中文输出，简明扼要，不要重复输入数据。";

  const userPrompt =
    "【输入数据】\n" +
    JSON.stringify(promptInput, null, 2) +
    "\n\n请输出 JSON: {\"knowledgeGoals\":[{point,evidence},...3-4 项], \"pedagogyAdvice\":[{method,evidence},...3-4 项], \"focusGroups\":[{group,action,studentNames,evidence},...2-3 项], \"nextSteps\":[{step,evidence},...3-4 项]}";

  const studentNameToId = new Map(
    diagnosis.studentInterventions.map((row) => [row.studentName, row.studentId]),
  );

  try {
    const ai = await aiGenerateJSON("insights", teacherId, systemPrompt, userPrompt, adviceSchema, 1);
    return {
      scope,
      generatedAt: now.toISOString(),
      source: "fresh",
      knowledgeGoals: ai.knowledgeGoals.slice(0, 4),
      pedagogyAdvice: ai.pedagogyAdvice.slice(0, 4),
      focusGroups: ai.focusGroups.slice(0, 3).map((group) => ({
        group: group.group,
        action: group.action,
        evidence: group.evidence,
        studentIds: group.studentNames
          .map((name) => studentNameToId.get(name))
          .filter((id): id is string => Boolean(id)),
      })),
      nextSteps: ai.nextSteps.slice(0, 4),
    };
  } catch (err) {
    console.error("[scope-insights] teaching advice LLM fallback:", err);
    return { ...fallback, notice: TEACHING_ADVICE_FALLBACK_NOTICE };
  }
}

function buildFallbackAdvice(
  scope: ScopeKey,
  now: Date,
  diagnosis: Awaited<ReturnType<typeof import("./analytics-v2.service").getAnalyticsV2Diagnosis>>,
  riskChapters: typeof diagnosis.chapterDiagnostics,
  interventionsTop: typeof diagnosis.studentInterventions,
): ScopeTeachingAdvice {
  const completionPct = diagnosis.kpis.completionRate !== null ? Math.round(diagnosis.kpis.completionRate * 100) : null;
  const avgScore = diagnosis.kpis.avgNormalizedScore;

  const knowledgeGoals: AdviceKnowledgeGoal[] = [];
  if (avgScore !== null && avgScore < 60) {
    knowledgeGoals.push({
      point: "强化基础知识点掌握",
      evidence: `当前归一化均分 ${avgScore.toFixed(1)}% 低于及格线，需巩固核心概念。`,
    });
  }
  for (const chapter of riskChapters.slice(0, 2)) {
    knowledgeGoals.push({
      point: `重点复盘「${chapter.title}」`,
      evidence: `该章节均分 ${chapter.avgNormalizedScore !== null ? chapter.avgNormalizedScore.toFixed(1) + "%" : "无"} / 完成率 ${chapter.completionRate !== null ? Math.round(chapter.completionRate * 100) + "%" : "无"}，存在掌握风险。`,
    });
  }
  if (knowledgeGoals.length === 0) {
    knowledgeGoals.push({
      point: "保持当前知识点节奏",
      evidence: `KPI 范围内未触发明显风险，可在下一节课开始小测稳住。`,
    });
  }

  const pedagogyAdvice: AdvicePedagogyAdvice[] = [
    {
      method: "针对低分维度安排 1 节翻转课堂",
      evidence: `共有 ${interventionsTop.filter((i) => i.reason === "low_score").length} 名学生归入「低掌握」，建议先小组讨论再统讲。`,
    },
    {
      method: "在课堂引入典型对话回放",
      evidence: `结合 simulation 高分学生回答片段做对照讲解，提升学生对评分维度的直觉。`,
    },
  ];

  const groupedByReason = new Map<string, typeof interventionsTop>();
  for (const row of interventionsTop) {
    const arr = groupedByReason.get(row.reason) ?? [];
    arr.push(row);
    groupedByReason.set(row.reason, arr);
  }
  const reasonLabels: Record<string, string> = {
    not_submitted: "未提交",
    low_score: "低掌握",
    declining: "退步",
  };
  const focusGroups: AdviceFocusGroup[] = Array.from(groupedByReason.entries())
    .map(([reason, rows]) => ({
      group: `${rows.length} 名${reasonLabels[reason] ?? reason}学生`,
      action:
        reason === "not_submitted"
          ? "课前点名 + 设定明确补交截止"
          : reason === "low_score"
            ? "课中安排 5 分钟 1v1 复盘 + 同类小练习"
            : "课后单独沟通学习节奏，必要时调整任务难度",
      studentIds: Array.from(new Set(rows.map((r) => r.studentId))),
      evidence: `${rows.slice(0, 3).map((r) => r.studentName).join("、")}${rows.length > 3 ? "等" : ""}`,
    }))
    .filter((group) => group.studentIds.length > 0)
    .slice(0, 3);

  const nextSteps: AdviceNextStep[] = [
    {
      step: completionPct !== null && completionPct < 60
        ? "先把未完成名单点齐再推进新内容"
        : "维持当前节奏，下一次课收一组小测",
      evidence: `当前完成率 ${completionPct !== null ? completionPct + "%" : "无"}。`,
    },
    {
      step: "在 Study Buddy 频道挂 1 个点评帖回复共性问题",
      evidence: "可减少课后重复答疑，并形成知识沉淀。",
    },
  ];
  if (diagnosis.kpis.pendingReleaseCount > 0) {
    nextSteps.push({
      step: `尽快批改并发布 ${diagnosis.kpis.pendingReleaseCount} 件待发布作业`,
      evidence: `截止日已过未发布数 = ${diagnosis.kpis.pendingReleaseCount}，会延迟学生反馈。`,
    });
  }

  return {
    scope,
    generatedAt: now.toISOString(),
    source: "fallback",
    knowledgeGoals,
    pedagogyAdvice,
    focusGroups,
    nextSteps,
    notice: TEACHING_ADVICE_FALLBACK_NOTICE,
  };
}

async function persistTeachingAdvice(
  scopeHash: string,
  advice: ScopeTeachingAdvice,
  teacherId: string | undefined,
): Promise<void> {
  const cached = await prisma.analysisReport.findFirst({
    where: { scopeHash },
    orderBy: { createdAt: "desc" },
    select: { id: true, scopeSummary: true },
  });
  const teachingPayload = serializeTeachingAdvice(advice);
  if (cached) {
    const existing =
      cached.scopeSummary && typeof cached.scopeSummary === "object" && !Array.isArray(cached.scopeSummary)
        ? (cached.scopeSummary as Record<string, unknown>)
        : {};
    await prisma.analysisReport.update({
      where: { id: cached.id },
      data: {
        scopeSummary: { ...existing, teachingAdvice: teachingPayload } as unknown as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.analysisReport.create({
      data: {
        scopeHash,
        scopeSummary: { teachingAdvice: teachingPayload } as unknown as Prisma.InputJsonValue,
        createdBy: teacherId ?? "system",
        studentCount: 0,
        report: { kind: "scope_teaching_advice" } as Prisma.InputJsonValue,
      },
    });
  }
}

function serializeTeachingAdvice(advice: ScopeTeachingAdvice) {
  return {
    generatedAt: advice.generatedAt,
    source: advice.source,
    knowledgeGoals: advice.knowledgeGoals,
    pedagogyAdvice: advice.pedagogyAdvice,
    focusGroups: advice.focusGroups,
    nextSteps: advice.nextSteps,
    notice: advice.notice ?? null,
  };
}

function parseCachedTeachingAdvice(
  raw: unknown,
): Omit<ScopeTeachingAdvice, "scope" | "source" | "staleAt"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const advice = r.teachingAdvice;
  if (!advice || typeof advice !== "object") return null;
  const a = advice as Record<string, unknown>;
  if (typeof a.generatedAt !== "string") return null;
  if (
    !Array.isArray(a.knowledgeGoals) ||
    !Array.isArray(a.pedagogyAdvice) ||
    !Array.isArray(a.focusGroups) ||
    !Array.isArray(a.nextSteps)
  ) {
    return null;
  }
  return {
    generatedAt: a.generatedAt,
    knowledgeGoals: a.knowledgeGoals as AdviceKnowledgeGoal[],
    pedagogyAdvice: a.pedagogyAdvice as AdvicePedagogyAdvice[],
    focusGroups: a.focusGroups as AdviceFocusGroup[],
    nextSteps: a.nextSteps as AdviceNextStep[],
    notice: typeof a.notice === "string" ? a.notice : undefined,
  };
}
