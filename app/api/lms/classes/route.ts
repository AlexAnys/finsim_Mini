import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { listClassesForStaff } from "@/lib/services/class.service";
import { parseListTake } from "@/lib/pagination";
import { success, handleServiceError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const classes = await listClassesForStaff({
      take: parseListTake(searchParams, 100, 200),
    });
    return success(classes);
  } catch (err) {
    return handleServiceError(err);
  }
}
