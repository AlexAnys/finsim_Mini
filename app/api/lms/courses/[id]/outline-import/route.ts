import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { created, handleServiceError, validationError } from "@/lib/api-utils";
import { getStorage, validateFile } from "@/lib/services/storage.service";
import { createAndProcessCourseKnowledgeSource } from "@/lib/services/course-knowledge-source.service";

const ALLOWED_SOURCE_TYPES = ["syllabus", "question_bank"] as const;
type AllowedSourceType = (typeof ALLOWED_SOURCE_TYPES)[number];

const DEFAULT_TAGS_BY_SOURCE: Record<AllowedSourceType, string[]> = {
  syllabus: ["课程大纲", "课程结构"],
  question_bank: ["课程题库"],
};

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
    const rawSourceType = (formData.get("sourceType") as string | null)?.trim();
    const sourceType: AllowedSourceType =
      rawSourceType && (ALLOWED_SOURCE_TYPES as readonly string[]).includes(rawSourceType)
        ? (rawSourceType as AllowedSourceType)
        : "syllabus";
    const tags = formData
      .getAll("tags")
      .flatMap((value) =>
        String(value)
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      );

    if (rawSourceType && !ALLOWED_SOURCE_TYPES.includes(rawSourceType as AllowedSourceType)) {
      return validationError("不支持的素材类型，请选择课程大纲或题库");
    }

    if (!file) {
      return validationError(
        sourceType === "question_bank"
          ? "请选择要上传的课程题库文件"
          : "请选择要上传的课程大纲或课程内容",
      );
    }

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
      sourceType,
      tags: [...DEFAULT_TAGS_BY_SOURCE[sourceType], ...tags],
    });

    return created(source);
  } catch (err) {
    return handleServiceError(err);
  }
}
