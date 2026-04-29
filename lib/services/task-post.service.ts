import { prisma } from "@/lib/db/prisma";
import { assertTaskInstanceReadable } from "@/lib/auth/resource-access";

type UserLike = { id: string; role: string; classId?: string | null };

export async function createTaskPost(
  input: {
    taskInstanceId: string;
    content: string;
    replyToPostId?: string;
  },
  user: UserLike,
) {
  await assertTaskInstanceReadable(input.taskInstanceId, user);

  const instance = await prisma.taskInstance.findUnique({
    where: { id: input.taskInstanceId },
    select: { status: true },
  });
  if (!instance) throw new Error("INSTANCE_NOT_FOUND");
  if (instance.status !== "published") throw new Error("TASK_NOT_PUBLISHED");

  if (input.replyToPostId) {
    const parent = await prisma.taskPost.findUnique({
      where: { id: input.replyToPostId },
      select: { taskInstanceId: true },
    });
    if (!parent) throw new Error("TASK_POST_NOT_FOUND");
    if (parent.taskInstanceId !== input.taskInstanceId) throw new Error("FORBIDDEN");
  }

  return prisma.taskPost.create({
    data: {
      taskInstanceId: input.taskInstanceId,
      authorId: user.id,
      content: input.content,
      replyToPostId: input.replyToPostId,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });
}

export async function listTaskPosts(
  taskInstanceId: string,
  user: UserLike,
  options: { take?: number } = {},
) {
  await assertTaskInstanceReadable(taskInstanceId, user);
  const take = Math.min(Math.max(options.take ?? 50, 1), 100);

  return prisma.taskPost.findMany({
    where: { taskInstanceId, replyToPostId: null },
    include: {
      author: { select: { id: true, name: true, role: true } },
      replies: {
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}
