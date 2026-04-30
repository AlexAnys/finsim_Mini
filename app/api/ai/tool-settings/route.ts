import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import {
  AI_MODEL_OPTIONS,
  AI_TOOL_DEFINITIONS,
  listAiToolSettings,
  upsertAiToolSetting,
} from "@/lib/services/ai-tool-settings.service";

const updateSchema = z.object({
  toolKey: z.string().min(1),
  model: z.string().optional().nullable(),
  thinking: z.enum(["disabled", "enabled"]).optional(),
  temperature: z.number().min(0).max(1.5).optional().nullable(),
  systemPromptSuffix: z.string().max(4000).optional().nullable(),
  enableSearch: z.boolean().optional(),
  strictness: z.string().max(40).optional().nullable(),
  outputStyle: z.string().max(80).optional().nullable(),
});

export async function GET() {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const settings = await listAiToolSettings(result.session.user.id);
    return success({
      tools: settings,
      modelOptions: AI_MODEL_OPTIONS,
      definitions: AI_TOOL_DEFINITIONS,
      searchProviderConfigured: Boolean(process.env.SEARCH_PROVIDER && process.env.SEARCH_API_KEY),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return validationError("请求参数错误", parsed.error.flatten());
    const setting = await upsertAiToolSetting(result.session.user.id, parsed.data);
    return success(setting);
  } catch (err) {
    return handleServiceError(err);
  }
}
