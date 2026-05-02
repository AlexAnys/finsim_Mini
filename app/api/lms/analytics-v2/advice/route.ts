import { NextRequest } from "next/server";
import type { TaskType } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { created, handleServiceError, success, validationError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import {
  buildDataInsightFingerprint,
  getAnalyticsV2Diagnosis,
  type AnalyticsV2Range,
  type AnalyticsV2ScoreBinMode,
  type AnalyticsV2ScorePolicy,
  type DataInsightAdvice,
} from "@/lib/services/analytics-v2.service";

const SCORE_POLICIES = new Set<AnalyticsV2ScorePolicy>(["latest", "best", "first"]);
const RANGES = new Set<AnalyticsV2Range>(["7d", "30d", "term", "custom"]);
const SCORE_BINS = new Set<AnalyticsV2ScoreBinMode>(["standard", "ten"]);
const TASK_TYPES = new Set<TaskType>(["simulation", "quiz", "subjective"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId")?.trim();
  if (!courseId) return validationError("courseId is required");

  const scorePolicyParam = searchParams.get("scorePolicy");
  if (scorePolicyParam && !SCORE_POLICIES.has(scorePolicyParam as AnalyticsV2ScorePolicy)) {
    return validationError("scorePolicy must be latest, best, or first");
  }

  const rangeParam = searchParams.get("range");
  if (rangeParam && !RANGES.has(rangeParam as AnalyticsV2Range)) {
    return validationError("range must be 7d, 30d, term, or custom");
  }

  const scoreBinsParam = searchParams.get("scoreBins");
  if (scoreBinsParam && !SCORE_BINS.has(scoreBinsParam as AnalyticsV2ScoreBinMode)) {
    return validationError("scoreBins must be standard or ten");
  }

  const taskTypeParam = searchParams.get("taskType");
  if (taskTypeParam && !TASK_TYPES.has(taskTypeParam as TaskType)) {
    return validationError("taskType must be simulation, quiz, or subjective");
  }

  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");
  if ((dateFromParam && !ISO_DATE.test(dateFromParam)) || (dateToParam && !ISO_DATE.test(dateToParam))) {
    return validationError("dateFrom/dateTo must use YYYY-MM-DD");
  }

  try {
    const { user } = auth.session;
    await assertCourseAccess(courseId, user.id, user.role);

    const input = {
      courseId,
      chapterId: searchParams.get("chapterId") ?? undefined,
      sectionId: searchParams.get("sectionId") ?? undefined,
      classId: searchParams.get("classId") ?? undefined,
      taskType: (taskTypeParam as TaskType | null) ?? undefined,
      taskInstanceId: searchParams.get("taskInstanceId") ?? undefined,
      scorePolicy: (scorePolicyParam as AnalyticsV2ScorePolicy | null) ?? undefined,
      range: (rangeParam as AnalyticsV2Range | null) ?? undefined,
      dateFrom: dateFromParam ?? undefined,
      dateTo: dateToParam ?? undefined,
      scoreBins: (scoreBinsParam as AnalyticsV2ScoreBinMode | null) ?? undefined,
    };

    const diagnosis = await getAnalyticsV2Diagnosis(input);
    const fingerprint = buildDataInsightFingerprint(diagnosis);
    const cached = await findCachedAdvice(courseId, user.id, fingerprint);
    if (cached) {
      return success({ job: cached.job, cachedAdvice: cached.advice });
    }

    const job = await enqueueAsyncJob({
      type: "data_insight_advice",
      entityType: "DataInsightAdvice",
      entityId: courseId,
      input: { ...input, fingerprint },
      createdBy: user.id,
      maxAttempts: 2,
    });

    return created({ job, cachedAdvice: null });
  } catch (err) {
    return handleServiceError(err);
  }
}

async function findCachedAdvice(courseId: string, userId: string, fingerprint: string) {
  const jobs = await prisma.asyncJob.findMany({
    where: {
      type: "data_insight_advice",
      entityType: "DataInsightAdvice",
      entityId: courseId,
      createdBy: userId,
      status: "succeeded",
    },
    orderBy: { completedAt: "desc" },
    take: 12,
  });

  for (const job of jobs) {
    const result = job.result as unknown as DataInsightAdvice | null;
    if (result?.fingerprint === fingerprint) {
      return { job, advice: result };
    }
  }
  return null;
}
