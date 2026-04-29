import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createCourse, getCoursesByTeacher, getCoursesByClass } from "@/lib/services/course.service";
import { parseListTake } from "@/lib/pagination";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createCourseSchema = z.object({
  courseTitle: z.string().min(1).max(200),
  courseCode: z.string().max(50).optional(),
  description: z.string().optional(),
  classId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const course = await createCourse({
      ...parsed.data,
      createdBy: result.session.user.id,
    });
    return created(course);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { user } = result.session;
    const { searchParams } = new URL(request.url);
    const options = { take: parseListTake(searchParams, 100, 200) };
    let courses;

    if (user.role === "student" && user.classId) {
      courses = await getCoursesByClass(user.classId, options);
    } else {
      courses = await getCoursesByTeacher(user.id, options);
    }

    return success(courses);
  } catch (err) {
    return handleServiceError(err);
  }
}
