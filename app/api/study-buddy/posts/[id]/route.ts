import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { hideStudyBuddyPost } from "@/lib/services/study-buddy.service";
import { success, handleServiceError } from "@/lib/api-utils";

/**
 * Unit 5b: 删除 (软删 = 隐藏) Study Buddy post
 * - 学生删自己 / 老师删自己创建的 task 下的 post / admin 任意
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await hideStudyBuddyPost(id, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
