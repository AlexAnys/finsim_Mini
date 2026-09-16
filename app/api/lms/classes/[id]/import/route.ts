import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { success, handleServiceError, validationError } from "@/lib/api-utils";
import { importClassRoster } from "@/lib/services/roster-import.service";
import { MAX_ROSTER_FILE_BYTES, rosterImportRequestSchema } from "@/lib/validators/roster-import.schema";

export const runtime = "nodejs";

// Limit the actual request stream, including requests without Content-Length.
async function limitedFormData(request: NextRequest) {
  const limit = MAX_ROSTER_FILE_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new Error("ROSTER_FILE_TOO_LARGE");
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    throw new Error("ROSTER_FILE_INVALID");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("ROSTER_EMPTY");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error("ROSTER_FILE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  } catch {
    throw new Error("ROSTER_FILE_INVALID");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const form = await limitedFormData(request);
    const parsed = rosterImportRequestSchema.safeParse({
      action: form.get("action"), previewHash: form.get("previewHash") || undefined,
      initialPassword: form.get("initialPassword") || undefined,
    });
    if (!parsed.success) return validationError(parsed.error.issues[0]?.message || "请选择预览或确认导入");
    const file = form.get("file");
    if (!file || typeof file === "string") return validationError("请选择学生名单文件");
    const data = await importClassRoster({
      classId: id, actor: { id: auth.session.user.id, role: auth.session.user.role },
      file: { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) }, ...parsed.data,
    });
    return success(data);
  } catch (error) {
    return handleServiceError(error);
  }
}
