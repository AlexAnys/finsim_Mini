import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { success, handleServiceError } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const members = await prisma.user.findMany({
      where: { classId: id, role: "student" },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
      take: 200,
    });
    return success(members);
  } catch (err) {
    return handleServiceError(err);
  }
}
