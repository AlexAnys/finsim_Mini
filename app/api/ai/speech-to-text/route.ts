import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import { resolveMimoBaseUrl } from "@/lib/services/ai.service";

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const formData = await request.formData();
    const audio = formData.get("audio") as File | null;
    if (!audio) return validationError("缺少音频文件");
    if (audio.size > 10 * 1024 * 1024) return validationError("音频文件过大，请控制在 10MB 以内");

    const provider = (process.env.STT_PROVIDER || "mimo").trim().toLowerCase();
    if (provider !== "mimo") {
      return success({
        text: "",
        provider,
        canFallback: true,
        message: "当前只接入了 MiMo ASR 语音识别；请设置 STT_PROVIDER=mimo，或手动输入。",
      });
    }

    const apiKey = process.env.MIMO_API_KEY;
    if (!apiKey) {
      return success({
        text: "",
        provider: "mimo",
        canFallback: true,
        message: "未配置 MIMO_API_KEY，无法使用云端语音识别。",
      });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const mimeType = audio.type || "audio/webm";
    const format = audioFormatFromMime(mimeType);
    const baseUrl = resolveMimoBaseUrl(apiKey).replace(/\/+$/, "");
    const model = process.env.MIMO_STT_MODEL || "mimo-v2.5-asr";

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
                type: "input_audio",
                input_audio: {
                  data: buffer.toString("base64"),
                  format,
                },
              },
            ],
          },
        ],
        asr_options: { language: "zh" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[speech-to-text] mimo returned", res.status, body.slice(0, 400));
      const canFallback = res.status >= 400;
      const userMsg =
        res.status === 401 || res.status === 403
          ? "云端语音识别鉴权失败：MIMO_API_KEY 无效或过期。"
          : res.status === 415 || res.status === 400
            ? "云端语音识别暂不可用，可改用浏览器语音或手动输入。"
            : res.status === 429
              ? "云端语音识别已达限流，请稍后再试或手动输入。"
              : `云端语音识别暂不可用：MiMo 返回 ${res.status}。`;
      return success({
        text: "",
        provider: "mimo",
        model,
        canFallback,
        message: userMsg,
      });
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const usableText = (json.choices?.[0]?.message?.content || "").trim();
    return success({
      text: usableText,
      provider: "mimo",
      model,
      canFallback: !usableText,
      message: usableText ? "语音已转成文字，请确认后发送。" : "MiMo 未返回可用转写文本，可切换浏览器实时识别或手动输入。",
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

// 前端会把 MediaRecorder 产物转码成 wav；保留 MIME 推断以兼容其他客户端。
function audioFormatFromMime(mimeType: string) {
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav") || mimeType.includes("wave") || mimeType.includes("x-wav")) return "wav";
  if (mimeType.includes("flac")) return "flac";
  if (mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mp4")) return "m4a"; // mp4/aac 容器映射到 m4a
  if (mimeType.includes("ogg") || mimeType.includes("opus")) return "ogg";
  return "wav"; // 兜底，避免 mimo 直接拒绝 webm
}
