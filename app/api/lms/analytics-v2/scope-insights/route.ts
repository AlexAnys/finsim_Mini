import { NextRequest } from "next/server";
import type { TaskType } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { success, validationError, handleServiceError, error as errorResponse } from "@/lib/api-utils";
import {
  getScopeSimulationInsights,
  getScopeStudyBuddySummary,
  type ScopeKey,
} from "@/lib/services/scope-insights.service";

const TASK_TYPES = new Set<TaskType>(["simulation", "quiz", "subjective"]);
const POST_TIMEOUT_MS = 25_000;

function readClassIds(searchParams: URLSearchParams): string[] {
  const multi = searchParams.getAll("classIds").map((id) => id.trim()).filter(Boolean);
  if (multi.length > 0) return multi;
  const legacy = searchParams.get("classId")?.trim();
  return legacy ? [legacy] : [];
}

function readScope(searchParams: URLSearchParams): ScopeKey | { error: string } {
  const courseId = searchParams.get("courseId")?.trim();
  if (!courseId) return { error: "courseId is required" };

  const taskTypeParam = searchParams.get("taskType");
  if (taskTypeParam && !TASK_TYPES.has(taskTypeParam as TaskType)) {
    return { error: "taskType must be simulation, quiz, or subjective" };
  }

  const classIds = readClassIds(searchParams);
  return {
    courseId,
    chapterId: searchParams.get("chapterId") ?? undefined,
    sectionId: searchParams.get("sectionId") ?? undefined,
    classIds: classIds.length > 0 ? classIds : undefined,
    taskType: (taskTypeParam as TaskType | null) ?? undefined,
    taskInstanceId: searchParams.get("taskInstanceId") ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const scope = readScope(searchParams);
  if ("error" in scope) return validationError(scope.error);

  try {
    const { user } = auth.session;
    await assertCourseAccess(scope.courseId, user.id, user.role);

    const [simulation, studyBuddy] = await Promise.all([
      getScopeSimulationInsights(scope, { teacherId: user.id }),
      getScopeStudyBuddySummary(scope),
    ]);

    return success({ simulation, studyBuddy });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const scope = readScope(searchParams);
  if ("error" in scope) return validationError(scope.error);

  try {
    const { user } = auth.session;
    await assertCourseAccess(scope.courseId, user.id, user.role);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SCOPE_INSIGHTS_TIMEOUT")), POST_TIMEOUT_MS),
    );

    const work = (async () => {
      const [simulation, studyBuddy] = await Promise.all([
        getScopeSimulationInsights(scope, { teacherId: user.id, forceFresh: true }),
        getScopeStudyBuddySummary(scope),
      ]);
      return { simulation, studyBuddy };
    })();

    const result = await Promise.race([work, timeout]);
    return success(result);
  } catch (err) {
    if (err instanceof Error && err.message === "SCOPE_INSIGHTS_TIMEOUT") {
      return errorResponse("SCOPE_INSIGHTS_TIMEOUT", "AI 调用超过 25 秒，请稍后重试", 504);
    }
    return handleServiceError(err);
  }
}
