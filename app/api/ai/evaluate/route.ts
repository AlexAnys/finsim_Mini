import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { evaluateSimulation } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { assetAllocationSchema } from "@/lib/validators/submission.schema";
import { z } from "zod";

const evaluateSchema = z.object({
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

    const evaluation = await evaluateSimulation(result.session.user.id, parsed.data);
    return success(evaluation);
  } catch (err) {
    return handleServiceError(err);
  }
}
