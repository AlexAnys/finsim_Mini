import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createTaskPost, listTaskPosts } from "@/lib/services/task-post.service";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createPostSchema = z.object({
  taskInstanceId: z.string().uuid(),
  content: z.string().min(1).max(5000),
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

    const { user } = result.session;
    const post = await createTaskPost(parsed.data, {
      id: user.id,
      role: user.role,
      classId: user.classId,
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
  const take = Number.parseInt(searchParams.get("take") || "50", 10);
  if (!taskInstanceId) {
    return validationError("taskInstanceId 参数必填");
  }

  try {
    const { user } = result.session;
    const posts = await listTaskPosts(
      taskInstanceId,
      { id: user.id, role: user.role, classId: user.classId },
      { take: Number.isFinite(take) ? take : 50 },
    );
    return success(posts);
  } catch (err) {
    return handleServiceError(err);
  }
}
