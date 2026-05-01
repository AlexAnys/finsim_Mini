import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { created, handleServiceError, validationError } from "@/lib/api-utils";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import { getStorage, validateFile } from "@/lib/services/storage.service";
import { workAssistantToolKeys, type WorkAssistantToolKey } from "@/lib/services/ai-work-assistant.service";

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const formData = await request.formData();
    const toolKey = formData.get("toolKey") as WorkAssistantToolKey | null;
    if (!toolKey || !workAssistantToolKeys.includes(toolKey)) return validationError("AI 工具类型不正确");

    const pastedText = ((formData.get("text") as string | null) || "").trim();
    const teacherRequest = ((formData.get("teacherRequest") as string | null) || "").trim();
    const outputStyle = ((formData.get("outputStyle") as string | null) || "structured").trim();
    const strictness = ((formData.get("strictness") as string | null) || "balanced").trim();
    const enableSearch = formData.get("enableSearch") === "true";
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (!pastedText && files.length === 0 && !teacherRequest) {
      return validationError("请粘贴内容，或上传文档/试卷后再分析");
    }

    const storage = getStorage();
    const savedFiles = [];
    for (const file of files.slice(0, 12)) {
      const validation = validateFile(file.type, file.size, ["document"]);
      if (!validation.valid) return validationError(validation.error!);
      const buffer = Buffer.from(await file.arrayBuffer());
      const { filePath } = await storage.save(buffer, file.name, file.type);
      savedFiles.push({
        fileName: file.name,
        filePath,
        mimeType: file.type || null,
      });
    }

    const job = await enqueueAsyncJob({
      type: "ai_work_assistant",
      entityType: "AiWorkAssistant",
      input: {
        toolKey,
        text: pastedText,
        teacherRequest,
        outputStyle,
        strictness,
        enableSearch,
        files: savedFiles,
      },
      createdBy: result.session.user.id,
      maxAttempts: 2,
    });

    return created({ job });
  } catch (err) {
    return handleServiceError(err);
  }
}
