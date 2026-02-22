import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { getStorage, validateFile } from "@/lib/services/storage.service";
import { created, validationError, serverError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return validationError("请选择要上传的文件");
    }

    const allowedTypes = ["image", "pdf", "word"];
    const validation = validateFile(file.type, file.size, allowedTypes);
    if (!validation.valid) {
      return validationError(validation.error!);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const { filePath, fileSize } = await storage.save(buffer, file.name, file.type);

    return created({
      filePath,
      fileName: file.name,
      fileSize,
      contentType: file.type,
      url: storage.getUrl(filePath),
    });
  } catch (err) {
    console.error("File upload error:", err);
    return serverError("文件上传失败");
  }
}
