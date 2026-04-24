import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertImportJobReadable } from "@/lib/auth/resource-access";
import { getImportJob } from "@/lib/services/import-job.service";
import { success, notFound, handleServiceError } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertImportJobReadable(id, { id: user.id, role: user.role });
    const job = await getImportJob(id);
    if (!job) return notFound("导入任务不存在");
    return success(job);
  } catch (err) {
    return handleServiceError(err);
  }
}
