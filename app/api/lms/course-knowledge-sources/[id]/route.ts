import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { handleServiceError, notFound, success } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const source = await prisma.courseKnowledgeSource.findUnique({
      where: { id },
      select: {
        id: true,
        courseId: true,
        chapterId: true,
        sectionId: true,
        taskId: true,
        taskInstanceId: true,
        fileName: true,
        mimeType: true,
        status: true,
        summary: true,
        conceptTags: true,
        error: true,
        extractedText: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!source) return notFound("上下文素材不存在");

    const user = result.session.user;
    await assertCourseAccess(source.courseId, user.id, user.role);

    return success(source);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const source = await prisma.courseKnowledgeSource.findUnique({
      where: { id },
      select: { id: true, courseId: true },
    });
    if (!source) return notFound("上下文素材不存在");

    const user = result.session.user;
    await assertCourseAccess(source.courseId, user.id, user.role);

    await prisma.courseKnowledgeSource.delete({ where: { id } });
    return success({ id });
  } catch (err) {
    return handleServiceError(err);
  }
}
