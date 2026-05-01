import { requireAuth } from "@/lib/auth/guards";
import { handleServiceError, success } from "@/lib/api-utils";
import { getAsyncJob } from "@/lib/services/async-job.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const job = await getAsyncJob(id, result.session.user);
    return success(job);
  } catch (err) {
    return handleServiceError(err);
  }
}
