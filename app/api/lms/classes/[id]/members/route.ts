import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertClassAccessForTeacher } from "@/lib/auth/resource-access";
import { listClassMembers } from "@/lib/services/class.service";
import { parseListTake } from "@/lib/pagination";
import { success, handleServiceError } from "@/lib/api-utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const { user } = result.session;
    await assertClassAccessForTeacher(id, { id: user.id, role: user.role });
    const { searchParams } = new URL(request.url);
    const members = await listClassMembers(id, {
      take: parseListTake(searchParams, 100, 200),
    });
    return success(members);
  } catch (err) {
    return handleServiceError(err);
  }
}
