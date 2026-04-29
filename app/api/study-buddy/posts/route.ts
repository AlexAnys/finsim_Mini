import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createPost, listStudyBuddyPosts } from "@/lib/services/study-buddy.service";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const createPostSchema = z.object({
  taskId: z.string().uuid(),
  taskInstanceId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  question: z.string().min(1).max(5000),
  mode: z.enum(["socratic", "direct"]),
  anonymous: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const result = await requireRole(["student"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const post = await createPost({
      user: {
        id: result.session.user.id,
        role: result.session.user.role,
        classId: result.session.user.classId,
      },
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
  const take = Number.parseInt(searchParams.get("take") || "100", 10);

  try {
    const { user } = result.session;
    const posts = await listStudyBuddyPosts({
      id: user.id,
      role: user.role,
      classId: user.classId,
    }, {
      taskId,
      taskInstanceId,
      take: Number.isFinite(take) ? take : 100,
    });
    return success(posts);
  } catch (err) {
    return handleServiceError(err);
  }
}
