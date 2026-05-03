import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getAnalyticsV2Diagnosis,
  type AnalyticsV2Diagnosis,
} from "./analytics-v2.service";
import type { ScopeKey } from "./scope-insights.service";

export interface MissingStudent {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  taskInstanceId: string;
  taskTitle: string;
}

export interface LowScorer {
  studentId: string;
  studentName: string;
  className: string;
  taskInstanceId: string;
  taskTitle: string;
  normalizedScore: number;
}

export interface PendingSubmission {
  submissionId: string;
  studentId: string;
  studentName: string;
  className: string;
  taskInstanceId: string;
  taskTitle: string;
  dueAt: string;
  submittedAt: string | null;
  status: string;
}

export interface RiskChapterDetail {
  chapterId: string | null;
  title: string;
  completionRate: number | null;
  avgNormalizedScore: number | null;
  instanceCount: number;
  instances: Array<{ id: string; title: string; classId: string; className: string }>;
}

export interface RiskStudentDetail {
  studentId: string;
  studentName: string;
  className: string;
  reason: "not_submitted" | "low_score" | "declining";
  selectedScore: number | null;
  taskInstances: Array<{ id: string; title: string }>;
}

const RESULT_LIMIT = 50;

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

async function loadDiagnosis(scope: ScopeKey): Promise<AnalyticsV2Diagnosis> {
  return getAnalyticsV2Diagnosis({
    courseId: scope.courseId,
    chapterId: scope.chapterId,
    sectionId: scope.sectionId,
    classIds: scope.classIds,
    taskType: scope.taskType,
    taskInstanceId: scope.taskInstanceId,
  });
}

export async function getMissingStudents(scope: ScopeKey): Promise<MissingStudent[]> {
  const instances = await prisma.taskInstance.findMany({
    where: buildInstanceWhere(scope),
    select: {
      id: true,
      title: true,
      classId: true,
      groupIds: true,
      class: { select: { id: true, name: true } },
      submissions: { select: { studentId: true } },
    },
    take: 200,
  });

  if (instances.length === 0) return [];

  const classIds = Array.from(new Set(instances.map((i) => i.classId)));
  const groupIds = Array.from(new Set(instances.flatMap((i) => i.groupIds)));

  const [classStudents, groups] = await Promise.all([
    classIds.length > 0
      ? prisma.user.findMany({
          where: { role: "student", classId: { in: classIds } },
          select: { id: true, name: true, classId: true },
        })
      : Promise.resolve([]),
    groupIds.length > 0
      ? prisma.studentGroup.findMany({
          where: { id: { in: groupIds } },
          select: {
            id: true,
            classId: true,
            members: {
              select: {
                student: { select: { id: true, name: true, classId: true, role: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const classStudentsByClass = new Map<string, Array<{ id: string; name: string }>>();
  for (const student of classStudents) {
    if (!student.classId) continue;
    const arr = classStudentsByClass.get(student.classId) ?? [];
    arr.push({ id: student.id, name: student.name });
    classStudentsByClass.set(student.classId, arr);
  }
  const groupStudentsByGroup = new Map<string, Array<{ id: string; name: string; classId: string }>>();
  for (const group of groups) {
    const members: Array<{ id: string; name: string; classId: string }> = [];
    for (const m of group.members) {
      if (m.student.role !== "student") continue;
      if (m.student.classId !== group.classId) continue;
      members.push({ id: m.student.id, name: m.student.name, classId: m.student.classId });
    }
    groupStudentsByGroup.set(group.id, members);
  }

  const result: MissingStudent[] = [];
  for (const inst of instances) {
    const submittedIds = new Set(inst.submissions.map((s) => s.studentId));
    let assigned: Array<{ id: string; name: string }> = [];
    if (inst.groupIds.length > 0) {
      const seen = new Set<string>();
      for (const gid of inst.groupIds) {
        const members = groupStudentsByGroup.get(gid) ?? [];
        for (const m of members) {
          if (m.classId !== inst.classId) continue;
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          assigned.push({ id: m.id, name: m.name });
        }
      }
    } else {
      assigned = (classStudentsByClass.get(inst.classId) ?? []).map((s) => ({ id: s.id, name: s.name }));
    }
    for (const student of assigned) {
      if (submittedIds.has(student.id)) continue;
      result.push({
        studentId: student.id,
        studentName: student.name,
        classId: inst.classId,
        className: inst.class.name,
        taskInstanceId: inst.id,
        taskTitle: inst.title,
      });
      if (result.length >= RESULT_LIMIT) return result;
    }
  }
  return result;
}

export async function getLowScorers(scope: ScopeKey, threshold = 60): Promise<LowScorer[]> {
  const diagnosis = await loadDiagnosis(scope);
  const instanceMetaById = new Map(
    diagnosis.instanceDiagnostics.map((i) => [i.instanceId, { title: i.title, className: i.className }]),
  );
  const submissions = await prisma.submission.findMany({
    where: {
      status: "graded",
      taskInstance: buildInstanceWhere(scope),
    },
    select: {
      id: true,
      studentId: true,
      taskInstanceId: true,
      score: true,
      maxScore: true,
      student: { select: { id: true, name: true } },
    },
    orderBy: { gradedAt: "desc" },
    take: 200,
  });

  const out: LowScorer[] = [];
  for (const s of submissions) {
    if (s.taskInstanceId === null) continue;
    const score = s.score === null ? null : Number(s.score);
    const maxScore = s.maxScore === null ? null : Number(s.maxScore);
    if (score === null || maxScore === null || maxScore <= 0) continue;
    const normalized = (score / maxScore) * 100;
    if (normalized >= threshold) continue;
    const meta = instanceMetaById.get(s.taskInstanceId);
    out.push({
      studentId: s.studentId,
      studentName: s.student.name,
      className: meta?.className ?? "未知班级",
      taskInstanceId: s.taskInstanceId,
      taskTitle: meta?.title ?? "未命名任务",
      normalizedScore: Math.round(normalized * 10) / 10,
    });
    if (out.length >= RESULT_LIMIT) break;
  }
  return out.sort((a, b) => a.normalizedScore - b.normalizedScore);
}

export async function getPendingReleaseList(scope: ScopeKey): Promise<PendingSubmission[]> {
  const now = new Date();
  const submissions = await prisma.submission.findMany({
    where: {
      releasedAt: null,
      taskInstance: { ...buildInstanceWhere(scope), dueAt: { lt: now } },
    },
    select: {
      id: true,
      studentId: true,
      taskInstanceId: true,
      submittedAt: true,
      status: true,
      student: { select: { id: true, name: true } },
      taskInstance: {
        select: {
          id: true,
          title: true,
          dueAt: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
    take: RESULT_LIMIT,
  });

  return submissions
    .filter((s) => s.taskInstance !== null && s.taskInstanceId !== null)
    .map((s) => ({
      submissionId: s.id,
      studentId: s.studentId,
      studentName: s.student.name,
      className: s.taskInstance!.class.name,
      taskInstanceId: s.taskInstanceId!,
      taskTitle: s.taskInstance!.title,
      dueAt: s.taskInstance!.dueAt.toISOString(),
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      status: s.status,
    }));
}

export async function getRiskChapters(scope: ScopeKey): Promise<RiskChapterDetail[]> {
  const diagnosis = await loadDiagnosis(scope);
  const riskChapters = diagnosis.chapterDiagnostics.filter(
    (chapter) =>
      (chapter.completionRate !== null && chapter.completionRate < 0.6) ||
      (chapter.avgNormalizedScore !== null && chapter.avgNormalizedScore < 60),
  );
  const result: RiskChapterDetail[] = [];
  for (const chapter of riskChapters) {
    const instances = diagnosis.instanceDiagnostics
      .filter((inst) => (inst.chapterId ?? null) === (chapter.chapterId ?? null))
      .map((inst) => ({
        id: inst.instanceId,
        title: inst.title,
        classId: inst.classId,
        className: inst.className,
      }));
    result.push({
      chapterId: chapter.chapterId,
      title: chapter.title,
      completionRate: chapter.completionRate,
      avgNormalizedScore: chapter.avgNormalizedScore,
      instanceCount: chapter.instanceCount,
      instances: instances.slice(0, 20),
    });
    if (result.length >= RESULT_LIMIT) break;
  }
  return result;
}

export async function getRiskStudents(scope: ScopeKey): Promise<RiskStudentDetail[]> {
  const diagnosis = await loadDiagnosis(scope);
  const byStudent = new Map<string, RiskStudentDetail>();
  for (const intervention of diagnosis.studentInterventions) {
    const existing = byStudent.get(intervention.studentId);
    const nextInstance = { id: intervention.instanceId, title: intervention.instanceTitle };
    if (existing) {
      if (!existing.taskInstances.some((t) => t.id === nextInstance.id)) {
        existing.taskInstances.push(nextInstance);
      }
      const reasonOrder: Record<string, number> = { not_submitted: 0, low_score: 1, declining: 2 };
      if (reasonOrder[intervention.reason] < reasonOrder[existing.reason]) {
        existing.reason = intervention.reason;
      }
      const score = intervention.selectedScore ?? Number.POSITIVE_INFINITY;
      const existingScore = existing.selectedScore ?? Number.POSITIVE_INFINITY;
      if (score < existingScore) existing.selectedScore = intervention.selectedScore;
    } else {
      byStudent.set(intervention.studentId, {
        studentId: intervention.studentId,
        studentName: intervention.studentName,
        className: intervention.className,
        reason: intervention.reason,
        selectedScore: intervention.selectedScore,
        taskInstances: [nextInstance],
      });
    }
  }
  return Array.from(byStudent.values())
    .sort((a, b) => {
      const reasonOrder: Record<string, number> = { not_submitted: 0, low_score: 1, declining: 2 };
      const ra = reasonOrder[a.reason];
      const rb = reasonOrder[b.reason];
      if (ra !== rb) return ra - rb;
      const sa = a.selectedScore ?? Number.POSITIVE_INFINITY;
      const sb = b.selectedScore ?? Number.POSITIVE_INFINITY;
      return sa - sb;
    })
    .slice(0, RESULT_LIMIT);
}

