import { NextRequest } from "next/server";
import type { TaskType } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { created, handleServiceError, validationError } from "@/lib/api-utils";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import type {
  AnalyticsV2Range,
  AnalyticsV2ScorePolicy,
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
    const job = await enqueueAsyncJob({
      type: "analytics_recompute",
      entityType: "AnalyticsV2Diagnosis",
      entityId: courseId,
      input: {
        courseId,
        chapterId: searchParams.get("chapterId"),
        sectionId: searchParams.get("sectionId"),
        classIds,
        taskType: taskTypeParam,
        taskInstanceId: searchParams.get("taskInstanceId"),
        scorePolicy: scorePolicyParam,
        range: rangeParam,
      },
      createdBy: user.id,
      maxAttempts: 2,
    });

    return created({ job });
  } catch (err) {
    return handleServiceError(err);
  }
}
