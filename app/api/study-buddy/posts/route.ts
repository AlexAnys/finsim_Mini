import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createPost } from "@/lib/services/study-buddy.service";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createPostSchema = z.object({
  taskId: z.string().uuid(),
  taskInstanceId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  question: z.string().min(1),
  mode: z.enum(["socratic", "direct"]),
  anonymous: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const post = await createPost({
      studentId: result.session.user.id,
      ...parsed.data,
    });
    return created(post);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId") || undefined;
  const taskInstanceId = searchParams.get("taskInstanceId") || undefined;

  try {
    const posts = await prisma.studyBuddyPost.findMany({
      where: {
        ...(taskId && { taskId }),
        ...(taskInstanceId && { taskInstanceId }),
        ...(result.session.user.role === "student" && { studentId: result.session.user.id }),
      },
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return success(posts);
  } catch (err) {
    return handleServiceError(err);
  }
}
