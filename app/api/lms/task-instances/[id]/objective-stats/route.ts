import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertTaskInstanceReadableTeacherOnly } from "@/lib/auth/resource-access";
import { getInstanceObjectiveStats } from "@/lib/services/instance-objective-stats.service";
import { success, handleServiceError } from "@/lib/api-utils";

/**
 * S4a 班级「客观体检」面板数据。
 *
 * 严格薄 handler：鉴权 + 委托 service + 返回，零业务逻辑（DB 访问 + 聚合编排全在
 * getInstanceObjectiveStats）。刻意独立于已臃肿的 .../insights route，不加重它。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
    const objectiveStats = await getInstanceObjectiveStats(id);
    return success(objectiveStats);
  } catch (err) {
    return handleServiceError(err);
  }
}
