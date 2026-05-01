import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { created, handleServiceError, success, validationError } from "@/lib/api-utils";
import { getStorage, validateFile } from "@/lib/services/storage.service";
import {
  assertKnowledgeSourceScope,
  createAndProcessCourseKnowledgeSource,
  listCourseKnowledgeSources,
} from "@/lib/services/course-knowledge-source.service";

export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const chapterId = searchParams.get("chapterId");
    const sectionId = searchParams.get("sectionId");
    const taskId = searchParams.get("taskId");
    const taskInstanceId = searchParams.get("taskInstanceId");
    if (!courseId) return validationError("缺少 courseId");

    const user = result.session.user;
    await assertCourseAccess(courseId, user.id, user.role);
    await assertKnowledgeSourceScope({ courseId, chapterId, sectionId, taskId, taskInstanceId });

    const sources = await listCourseKnowledgeSources({ courseId, chapterId, sectionId, taskId, taskInstanceId });
    return success(sources);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const courseId = formData.get("courseId") as string | null;
    const chapterId = (formData.get("chapterId") as string | null) || null;
    const sectionId = (formData.get("sectionId") as string | null) || null;
    const taskId = (formData.get("taskId") as string | null) || null;
    const taskInstanceId = (formData.get("taskInstanceId") as string | null) || null;

    if (!courseId) return validationError("缺少 courseId");
    if (!file) return validationError("请选择要上传的课程素材");

    const user = result.session.user;
    await assertCourseAccess(courseId, user.id, user.role);
    await assertKnowledgeSourceScope({ courseId, chapterId, sectionId, taskId, taskInstanceId });

    const validation = validateFile(file.type, file.size, ["document"]);
    if (!validation.valid) return validationError(validation.error!);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const { filePath } = await storage.save(buffer, file.name, file.type);

    const source = await createAndProcessCourseKnowledgeSource({
      teacherId: user.id,
      courseId,
      chapterId,
      sectionId,
      taskId,
      taskInstanceId,
      fileName: file.name,
      filePath,
      mimeType: file.type,
    });

    return created(source);
  } catch (err) {
    return handleServiceError(err);
  }
}
