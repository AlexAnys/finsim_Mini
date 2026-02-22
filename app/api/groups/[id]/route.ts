import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { updateGroup, deleteGroup } from "@/lib/services/group.service";
import { success, handleServiceError } from "@/lib/api-utils";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const group = await updateGroup(id, result.session.user.id, body);
    return success(group);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    await deleteGroup(id, result.session.user.id);
    return success({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
