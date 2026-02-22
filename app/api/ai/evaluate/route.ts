import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { evaluateSimulation } from "@/lib/services/ai.service";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
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
  assets: z.object({
    sections: z.array(z.object({
      label: z.string(),
      items: z.array(z.object({ label: z.string(), value: z.number() })),
    })),
  }).optional(),
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
