import { NextRequest } from "next/server";
import type { TaskType } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import {
  getAnalyticsV2Diagnosis,
  type AnalyticsV2Range,
  type AnalyticsV2ScorePolicy,
} from "@/lib/services/analytics-v2.service";

const SCORE_POLICIES = new Set<AnalyticsV2ScorePolicy>(["latest", "best", "first"]);
const RANGES = new Set<AnalyticsV2Range>(["7d", "30d", "term"]);
const TASK_TYPES = new Set<TaskType>(["simulation", "quiz", "subjective"]);

function readClassIds(searchParams: URLSearchParams): string[] {
  const multi = searchParams.getAll("classIds").map((id) => id.trim()).filter(Boolean);
  if (multi.length > 0) return multi;
  const legacy = searchParams.get("classId")?.trim();
  return legacy ? [legacy] : [];
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId")?.trim();
  if (!courseId) {
    return validationError("courseId is required");
  }

  const scorePolicyParam = searchParams.get("scorePolicy");
  if (scorePolicyParam && !SCORE_POLICIES.has(scorePolicyParam as AnalyticsV2ScorePolicy)) {
    return validationError("scorePolicy must be latest, best, or first");
  }

  const rangeParam = searchParams.get("range");
  if (rangeParam && !RANGES.has(rangeParam as AnalyticsV2Range)) {
    return validationError("range must be 7d, 30d, or term");
  }

  const taskTypeParam = searchParams.get("taskType");
  if (taskTypeParam && !TASK_TYPES.has(taskTypeParam as TaskType)) {
    return validationError("taskType must be simulation, quiz, or subjective");
  }

  try {
    const { user } = auth.session;
    await assertCourseAccess(courseId, user.id, user.role);

    const classIds = readClassIds(searchParams);
    const diagnosis = await getAnalyticsV2Diagnosis({
      courseId,
      chapterId: searchParams.get("chapterId") ?? undefined,
      sectionId: searchParams.get("sectionId") ?? undefined,
      classIds: classIds.length > 0 ? classIds : undefined,
      taskType: (taskTypeParam as TaskType | null) ?? undefined,
      taskInstanceId: searchParams.get("taskInstanceId") ?? undefined,
      scorePolicy: (scorePolicyParam as AnalyticsV2ScorePolicy | null) ?? undefined,
      range: (rangeParam as AnalyticsV2Range | null) ?? undefined,
    });

    return success(diagnosis);
  } catch (err) {
    return handleServiceError(err);
  }
}
