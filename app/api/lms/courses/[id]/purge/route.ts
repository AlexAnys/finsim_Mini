import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { purgeCourse } from "@/lib/services/course.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const purgeSchema = z.object({
  confirmTitle: z.string().min(1),
});

// 彻底删除课程（不可恢复）。需在 body 提供 confirmTitle 与课程名一致强确认。
// 级联删除全部后代（不删共享 Task 模板）+ owner/admin 守卫 + audit，均在 Service。
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = purgeSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请输入课程名称以确认彻底删除", parsed.error.flatten());
    }
    const counts = await purgeCourse(
      id,
      result.session.user.id,
      result.session.user.role,
      parsed.data.confirmTitle,
    );
    return success({ purged: true, ...counts });
  } catch (err) {
    return handleServiceError(err);
  }
}
