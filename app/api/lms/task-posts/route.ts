import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createPostSchema = z.object({
  taskInstanceId: z.string().uuid(),
  content: z.string().min(1),
  replyToPostId: z.string().uuid().optional(),
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

    // 验证任务已发布
    const instance = await prisma.taskInstance.findUnique({
      where: { id: parsed.data.taskInstanceId },
    });
    if (!instance || instance.status !== "published") {
      return validationError("任务尚未发布，无法发帖");
    }

    const post = await prisma.taskPost.create({
      data: {
        taskInstanceId: parsed.data.taskInstanceId,
        authorId: result.session.user.id,
        content: parsed.data.content,
        replyToPostId: parsed.data.replyToPostId,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
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
  const taskInstanceId = searchParams.get("taskInstanceId");
  if (!taskInstanceId) {
    return validationError("taskInstanceId 参数必填");
  }

  try {
    const posts = await prisma.taskPost.findMany({
      where: { taskInstanceId, replyToPostId: null },
      include: {
        author: { select: { id: true, name: true, role: true } },
        replies: {
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return success(posts);
  } catch (err) {
    return handleServiceError(err);
  }
}
