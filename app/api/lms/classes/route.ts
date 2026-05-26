import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { createClass, listClassesForStaff } from "@/lib/services/class.service";
import { parseListTake } from "@/lib/pagination";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const classes = await listClassesForStaff({
      take: parseListTake(searchParams, 100, 200),
    });
    return success(classes);
  } catch (err) {
    return handleServiceError(err);
  }
}

const createClassSchema = z.object({
  name: z.string().trim().min(1, "请输入班级名称").max(100, "班级名称过长"),
  academicYear: z.string().trim().max(20, "学年过长").optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = createClassSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "请求参数有误");
  }

  try {
    const cls = await createClass({
      name: parsed.data.name,
      academicYear: parsed.data.academicYear,
      createdBy: result.session.user.id,
    });
    return created(cls);
  } catch (err) {
    return handleServiceError(err);
  }
}
