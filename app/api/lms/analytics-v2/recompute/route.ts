import { NextRequest } from "next/server";
import type { TaskType } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { created, handleServiceError, validationError } from "@/lib/api-utils";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import type {
  AnalyticsV2Range,
  AnalyticsV2ScoreBinMode,
  AnalyticsV2ScorePolicy,
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

  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");
  if ((dateFromParam && !ISO_DATE.test(dateFromParam)) || (dateToParam && !ISO_DATE.test(dateToParam))) {
    return validationError("dateFrom/dateTo must use YYYY-MM-DD");
  }

  const taskTypeParam = searchParams.get("taskType");
  if (taskTypeParam && !TASK_TYPES.has(taskTypeParam as TaskType)) {
    return validationError("taskType must be simulation, quiz, or subjective");
  }

  try {
    const { user } = auth.session;
    await assertCourseAccess(courseId, user.id, user.role);

    const job = await enqueueAsyncJob({
      type: "analytics_recompute",
      entityType: "AnalyticsV2Diagnosis",
      entityId: courseId,
      input: {
        courseId,
        chapterId: searchParams.get("chapterId"),
        sectionId: searchParams.get("sectionId"),
        classId: searchParams.get("classId"),
        taskType: taskTypeParam,
        taskInstanceId: searchParams.get("taskInstanceId"),
        scorePolicy: scorePolicyParam,
        range: rangeParam,
        dateFrom: dateFromParam,
        dateTo: dateToParam,
        scoreBins: scoreBinsParam,
      },
      createdBy: user.id,
      maxAttempts: 2,
    });

    return created({ job });
  } catch (err) {
    return handleServiceError(err);
  }
}
