import { requireAuth } from "@/lib/auth/guards";
import { getTeacherDashboard, getStudentDashboard } from "@/lib/services/dashboard.service";
import { success, handleServiceError } from "@/lib/api-utils";

export async function GET() {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { user } = result.session;

    if (user.role === "teacher" || user.role === "admin") {
      const data = await getTeacherDashboard(user.id);
      return success(data);
    } else {
      const data = await getStudentDashboard(user.id, user.classId || "");
      return success(data);
    }
  } catch (err) {
    return handleServiceError(err);
  }
}
