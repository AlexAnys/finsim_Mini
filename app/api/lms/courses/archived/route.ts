import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getArchivedCourses } from "@/lib/services/course.service";
import { parseListTake } from "@/lib/pagination";
import { success, handleServiceError } from "@/lib/api-utils";

// 回收站列表：已归档课程（teacher 看自有/协作，admin 看全部）。仅 teacher/admin 可访问。
// 静态段 /courses/archived 优先于动态 /courses/[id]，不会被误当作课程 id。
export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { user } = result.session;
    const { searchParams } = new URL(request.url);
    const courses = await getArchivedCourses(user.id, user.role, {
      take: parseListTake(searchParams, 100, 200),
    });
    return success(courses);
  } catch (err) {
    return handleServiceError(err);
  }
}
