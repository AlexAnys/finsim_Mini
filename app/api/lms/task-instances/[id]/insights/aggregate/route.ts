import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertTaskInstanceReadableTeacherOnly } from "@/lib/auth/resource-access";
import {
  aggregateInsights,
  getCachedInsights,
} from "@/lib/services/insights.service";
import { success, handleServiceError } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertTaskInstanceReadableTeacherOnly(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    const cached = await getCachedInsights(id, user.id);
    return success({
      cached: !!cached,
      ...(cached ?? {
        commonIssues: null,
        aggregatedAt: null,
        studentCount: 0,
        reportId: null,
      }),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertTaskInstanceReadableTeacherOnly(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    const aggregated = await aggregateInsights(id, user.id);
    return success({ cached: false, ...aggregated });
  } catch (err) {
    return handleServiceError(err);
  }
}
