import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { evaluateSimulation } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { assetAllocationSchema } from "@/lib/validators/submission.schema";
import { prisma } from "@/lib/db/prisma";
import { assertTaskInstanceReadable, assertTaskReadable } from "@/lib/auth/resource-access";
import { z } from "zod";

const evaluateSchema = z.object({
  taskId: z.string().uuid().optional(),
  taskInstanceId: z.string().uuid().optional(),
  taskName: z.string(),
  requirements: z.string().optional(),
  scenario: z.string(),
  evaluatorPersona: z.string().optional(),
  strictnessLevel: z.string().default("MODERATE"),
  transcript: z.array(z.object({ role: z.string(), text: z.string() })),
  rubric: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    maxPoints: z.number(),
  })),
  // PR-FIX-2 B4: 复用 assetAllocationSchema（含 snapshots），原 inline schema 缺 snapshots 导致 zod strip
  assets: assetAllocationSchema.optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = evaluateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const settingsUserId = await resolveSettingsUserId({
      user: result.session.user,
      taskId: parsed.data.taskId,
      taskInstanceId: parsed.data.taskInstanceId,
    });
    const evaluation = await evaluateSimulation(result.session.user.id, parsed.data, {
      settingsUserId,
      metadata: {
        taskId: parsed.data.taskId,
        taskInstanceId: parsed.data.taskInstanceId,
        settingsSource: settingsUserId === result.session.user.id ? "actor" : "teacher",
      },
    });
    return success(evaluation);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function resolveSettingsUserId(input: {
  user: { id: string; role: string; classId?: string | null };
  taskId?: string;
  taskInstanceId?: string;
}) {
  if (input.taskInstanceId) {
    await assertTaskInstanceReadable(input.taskInstanceId, input.user);
    const instance = await prisma.taskInstance.findUnique({
      where: { id: input.taskInstanceId },
      select: { taskId: true, createdBy: true },
    });
    if (!instance) throw new Error("INSTANCE_NOT_FOUND");
    if (input.taskId && instance.taskId !== input.taskId) throw new Error("FORBIDDEN");
    return instance.createdBy || input.user.id;
  }

  if (input.taskId) {
    await assertTaskReadable(input.taskId, input.user);
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { creatorId: true },
    });
    return task?.creatorId || input.user.id;
  }

  return input.user.id;
}
