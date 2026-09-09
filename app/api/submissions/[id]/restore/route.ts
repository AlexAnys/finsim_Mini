import { requireRole } from "@/lib/auth/guards";
import { restoreSubmission } from "@/lib/services/submission.service";
import { success, handleServiceError } from "@/lib/api-utils";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;
  try { return success(await restoreSubmission((await params).id, auth.session.user)); }
  catch (err) { return handleServiceError(err); }
}
