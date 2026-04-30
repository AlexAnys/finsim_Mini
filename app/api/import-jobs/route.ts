import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createImportJob } from "@/lib/services/import-job.service";
import { getStorage, validateFile } from "@/lib/services/storage.service";
import { created, validationError, handleServiceError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const taskId = formData.get("taskId") as string | null;

    if (!file) {
      return validationError("请选择要上传的文件");
    }
    if (!taskId) {
      return validationError("缺少 taskId");
    }

    const validation = validateFile(file.type, file.size, ["document"]);
    if (!validation.valid) {
      return validationError(validation.error!);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const { filePath } = await storage.save(buffer, file.name, file.type);

    const job = await createImportJob({
      teacherId: result.session.user.id,
      taskId,
      fileName: file.name,
      filePath,
    });

    return created(job);
  } catch (err) {
    return handleServiceError(err);
  }
}
