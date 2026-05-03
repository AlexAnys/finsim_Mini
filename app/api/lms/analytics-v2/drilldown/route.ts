import { NextRequest } from "next/server";
import type { TaskType } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import {
  getMissingStudents,
  getScoreBinStudents,
  getLowScorers,
  getPendingReleaseList,
  getRiskChapters,
  getRiskStudents,
} from "@/lib/services/scope-drilldown.service";
import type { ScopeKey } from "@/lib/services/scope-insights.service";

const TASK_TYPES = new Set<TaskType>(["simulation", "quiz", "subjective"]);
const KINDS = new Set([
  "score_bin",
  "completion_rate",
  "avg_score",
  "pending_release",
  "risk_chapter",
  "risk_student",
] as const);
type DrilldownKind = typeof KINDS extends Set<infer T> ? T : never;

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
  const kindParam = searchParams.get("kind");
  if (!kindParam || !KINDS.has(kindParam as DrilldownKind)) {
    return validationError(
      "kind must be one of: score_bin, completion_rate, avg_score, pending_release, risk_chapter, risk_student",
    );
  }

  const scope = readScope(searchParams);
  if ("error" in scope) return validationError(scope.error);

  try {
    const { user } = auth.session;
    await assertCourseAccess(scope.courseId, user.id, user.role);

    switch (kindParam as DrilldownKind) {
      case "score_bin": {
        const binLabel = searchParams.get("binLabel");
        const classFilter = searchParams.get("binClassId");
        if (!binLabel) return validationError("binLabel is required for score_bin");
        const items = await getScoreBinStudents(scope, binLabel, classFilter ?? undefined);
        return success({ kind: "score_bin", items });
      }
      case "completion_rate": {
        const items = await getMissingStudents(scope);
        return success({ kind: "completion_rate", items });
      }
      case "avg_score": {
        const items = await getLowScorers(scope);
        return success({ kind: "avg_score", items });
      }
      case "pending_release": {
        const items = await getPendingReleaseList(scope);
        return success({ kind: "pending_release", items });
      }
      case "risk_chapter": {
        const items = await getRiskChapters(scope);
        return success({ kind: "risk_chapter", items });
      }
      case "risk_student": {
        const items = await getRiskStudents(scope);
        return success({ kind: "risk_student", items });
      }
    }
  } catch (err) {
    return handleServiceError(err);
  }
}
