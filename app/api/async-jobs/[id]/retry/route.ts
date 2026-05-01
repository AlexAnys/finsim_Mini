import { requireAuth } from "@/lib/auth/guards";
import { handleServiceError, success } from "@/lib/api-utils";
import { retryAsyncJob } from "@/lib/services/async-job.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const job = await retryAsyncJob(id, result.session.user);
    return success(job);
  } catch (err) {
    return handleServiceError(err);
  }
}
