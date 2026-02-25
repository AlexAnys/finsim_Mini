import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { getCourseWithStructure } from "@/lib/services/course.service";
import { success, notFound, validationError, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const course = await getCourseWithStructure(id);
    if (!course) return notFound("课程不存在");
    return success(course);
  } catch (err) {
    return handleServiceError(err);
  }
}

const patchSchema = z.object({
  semesterStartDate: z.string().datetime().optional(),
  courseTitle: z.string().min(1).optional(),
  description: z.string().optional(),
  classId: z.string().uuid().optional(),
}).refine(data => Object.keys(data).length > 0, { message: "至少提供一个字段" });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.semesterStartDate) {
      updateData.semesterStartDate = new Date(parsed.data.semesterStartDate);
    }
    if (parsed.data.courseTitle) updateData.courseTitle = parsed.data.courseTitle;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.classId) updateData.classId = parsed.data.classId;

    const updated = await prisma.course.update({ where: { id }, data: updateData });
    return success(updated);
  } catch (err) {
    return handleServiceError(err);
  }
}
