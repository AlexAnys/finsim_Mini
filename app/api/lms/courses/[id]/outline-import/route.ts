import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { created, handleServiceError, validationError } from "@/lib/api-utils";
import { getStorage, validateFile } from "@/lib/services/storage.service";
import { createAndProcessCourseKnowledgeSource } from "@/lib/services/course-knowledge-source.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id: courseId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tags = formData
      .getAll("tags")
      .flatMap((value) =>
        String(value)
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      );

    if (!file) return validationError("请选择要上传的课程大纲或课程内容");

    const user = result.session.user;
    await assertCourseAccess(courseId, user.id, user.role);

    const validation = validateFile(file.type, file.size, ["document"]);
    if (!validation.valid) return validationError(validation.error!);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const { filePath } = await storage.save(buffer, file.name, file.type);

    const source = await createAndProcessCourseKnowledgeSource({
      teacherId: user.id,
      courseId,
      fileName: file.name,
      filePath,
      mimeType: file.type,
      sourceType: "syllabus",
      tags: ["课程大纲", "课程结构", ...tags],
    });

    return created(source);
  } catch (err) {
    return handleServiceError(err);
  }
}
