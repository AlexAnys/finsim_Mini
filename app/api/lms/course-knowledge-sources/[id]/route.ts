import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { getCourseActorRole } from "@/lib/auth/actor-role";
import { logAuditEvent } from "@/lib/services/audit.service";
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
        sourceType: true,
        status: true,
        summary: true,
        conceptTags: true,
        tags: true,
        error: true,
        extractedText: true,
        structuredData: true,
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
  request: NextRequest,
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
        teacherId: true,
        fileName: true,
      },
    });
    if (!source) return notFound("上下文素材不存在");

    const user = result.session.user;
    await assertCourseAccess(source.courseId, user.id, user.role);

    // Unit 5c: 协作者删除非自己上传的素材，需带 force=true 二级确认
    const force =
      new URL(request.url).searchParams.get("force") === "true";
    const actorRole = await getCourseActorRole(
      source.courseId,
      user.id,
      user.role,
    );
    const isOwnUpload = source.teacherId === user.id;
    if (!isOwnUpload && !force && actorRole !== "admin") {
      throw new Error("KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM");
    }

    await prisma.courseKnowledgeSource.delete({ where: { id } });
    await logAuditEvent({
      action: "course_knowledge_source.delete",
      actorRole,
      actorId: user.id,
      targetId: id,
      targetType: "CourseKnowledgeSource",
      metadata: {
        courseId: source.courseId,
        fileName: source.fileName,
        ownerTeacherId: source.teacherId,
        byOwner: isOwnUpload,
        byCollaborator: !isOwnUpload && actorRole === "collaborator",
      },
    });
    return success({ id });
  } catch (err) {
    return handleServiceError(err);
  }
}
