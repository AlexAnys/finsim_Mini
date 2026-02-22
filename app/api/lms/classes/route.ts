import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { success, handleServiceError } from "@/lib/api-utils";

export async function GET() {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { students: true } },
      },
    });
    return success(classes);
  } catch (err) {
    return handleServiceError(err);
  }
}
