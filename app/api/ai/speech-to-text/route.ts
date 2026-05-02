import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import { resolveMimoBaseUrl } from "@/lib/services/ai.service";

const STT_PROMPT = "请把这段音频转写成简体中文文本。只返回转写文本，不要解释。";

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const formData = await request.formData();
    const audio = formData.get("audio") as File | null;
    if (!audio) return validationError("缺少音频文件");
    if (audio.size > 16 * 1024 * 1024) return validationError("音频文件过大，请控制在 16MB 以内");

    const provider = (process.env.STT_PROVIDER || "mimo").trim().toLowerCase();
    if (provider !== "mimo") {
      return success({
        text: "",
        provider,
        message: "当前只接入了 MiMo Omni 语音识别尝试；请设置 STT_PROVIDER=mimo，或手动输入。",
      });
    }

    const apiKey = process.env.MIMO_API_KEY;
    if (!apiKey) {
      return success({
        text: "",
        provider: "mimo",
        message: "未配置 MIMO_API_KEY，无法使用云端语音识别。",
      });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const mimeType = audio.type || "audio/webm";
    const format = audioFormatFromMime(mimeType);
    const baseUrl = resolveMimoBaseUrl(apiKey).replace(/\/+$/, "");
    const model = process.env.MIMO_STT_MODEL || process.env.MIMO_OMNI_MODEL || "mimo-v2-omni";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: STT_PROMPT,
              },
              {
                type: "input_audio",
                input_audio: {
                  data: buffer.toString("base64"),
                  format,
                },
              },
            ],
          },
        ],
        temperature: 0,
        max_completion_tokens: 1200,
        thinking: { type: "disabled" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return success({
        text: "",
        provider: "mimo",
        model,
        message: `云端语音识别暂不可用：MiMo 返回 ${res.status} ${body.slice(0, 180)}`,
      });
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = (json.choices?.[0]?.message?.content || "").trim();
    const usableText = normalizeTranscription(text);
    return success({
      text: usableText,
      provider: "mimo",
      model,
      message: usableText ? "语音已转成文字，请确认后发送。" : "MiMo 未返回可用转写文本，请重试或手动输入。",
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

function normalizeTranscription(text: string) {
  const normalized = text.trim();
  if (!normalized) return "";

  const compact = normalized.replace(/\s+/g, "");
  const promptCompact = STT_PROMPT.replace(/\s+/g, "");
  const promptEcho =
    compact === promptCompact ||
    compact.includes(promptCompact.slice(0, 16)) ||
    /^请把.{0,8}音频.{0,8}转写/.test(compact);

  if (promptEcho) return "";
  return normalized;
}

function audioFormatFromMime(mimeType: string) {
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}
