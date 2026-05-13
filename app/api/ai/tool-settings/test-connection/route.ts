import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { handleServiceError, success, validationError, error as apiError } from "@/lib/api-utils";
import { getProviderConfig, aiGenerateText } from "@/lib/services/ai.service";

/**
 * Fix 4 (review fixes batch 1) · AI Provider 测试连接
 *
 * POST /api/ai/tool-settings/test-connection
 * body: { provider: "mimo"|..., model?: string }
 *
 * 一次性 ping：发个最短 system/user prompt 走 aiGenerateText，回来证明 key/baseURL/model OK。
 * 不写 DB，只算诊断；缺 key 时返回中文错误。
 */

const schema = z.object({
  provider: z.enum(["mimo", "qwen", "deepseek", "gemini", "openai"]),
  model: z.string().max(120).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const guard = await requireRole(["teacher", "admin"]);
  if (guard.error) return guard.error;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationError("请求参数错误", parsed.error.flatten());

    const { provider: providerName, model } = parsed.data;
    const provider = getProviderConfig(providerName);
    if (!provider) {
      return apiError(
        "AI_PROVIDER_NOT_CONFIGURED",
        `${providerName} provider 不存在`,
        400,
      );
    }
    if (!provider.apiKey) {
      const labels: Record<string, string> = {
        mimo: "小米 MiMo",
        qwen: "阿里通义千问",
        deepseek: "DeepSeek",
        gemini: "Google Gemini",
        openai: "OpenAI",
      };
      const envKey: Record<string, string> = {
        mimo: "MIMO_API_KEY",
        qwen: "QWEN_API_KEY",
        deepseek: "DEEPSEEK_API_KEY",
        gemini: "GEMINI_API_KEY",
        openai: "OPENAI_API_KEY",
      };
      return apiError(
        "AI_PROVIDER_KEY_MISSING",
        `${labels[providerName] ?? providerName} API key 未配置（请设置 ${envKey[providerName] ?? providerName} 环境变量）`,
        400,
      );
    }

    const startedAt = Date.now();
    const text = await aiGenerateText(
      // 用 simulation feature 跑 ping 是为了走和真实学生 chat 同一条 thinking-OFF 路径，
      // 试出来的状态最接近实战；ai.service 的 createAiRun 会留一条 audit 行供排查。
      "simulation",
      guard.session.user.id,
      "你是测试 echo bot。请只回复以下用户消息中的数字（不加任何前缀/后缀）。",
      "test-1-2-3",
      {
        settingsUserId: guard.session.user.id,
        metadata: {
          probe: "test-connection",
          requestedProvider: providerName,
          requestedModel: model ?? null,
        },
      },
    );

    return success({
      ok: true,
      latencyMs: Date.now() - startedAt,
      providerName,
      effectiveModel: provider.defaultModel,
      sample: text.slice(0, 200),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
