import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { success, handleServiceError, validationError } from "@/lib/api-utils";
import { manageClassRoster } from "@/lib/services/roster.service";
import { rosterSchema } from "@/lib/validators/roster.schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["teacher", "admin"]);
  if (auth.error) return auth.error;

  try {
    const parsed = rosterSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "请检查操作内容", parsed.error.flatten());
    const { id } = await params;
    const { user } = auth.session;
    return success(await manageClassRoster(id, { id: user.id, role: user.role }, parsed.data));
  } catch (err) {
    if (err instanceof SyntaxError) return validationError("请求内容格式错误");
    return handleServiceError(err);
  }
}
