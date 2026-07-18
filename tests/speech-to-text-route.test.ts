import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/services/ai.service", () => ({
  resolveMimoBaseUrl: vi.fn(() => "https://mimo.example/v1"),
}));

import { POST } from "@/app/api/ai/speech-to-text/route";

const ORIGINAL_ENV = { ...process.env };

function buildAudioRequest() {
  const formData = new FormData();
  formData.set("audio", new File(["wav-bytes"], "recording.wav", { type: "audio/wav" }));
  return new NextRequest("http://localhost/api/ai/speech-to-text", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  process.env.STT_PROVIDER = "mimo";
  process.env.MIMO_API_KEY = "test-key";
  delete process.env.MIMO_STT_MODEL;
  process.env.MIMO_OMNI_MODEL = "mimo-v2-omni";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("POST /api/ai/speech-to-text", () => {
  it("sends the verified MiMo ASR-only request body", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://mimo.example/v1/chat/completions");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      });
      return Response.json({ choices: [{ message: { content: "你好。" } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(buildAudioRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      model: "mimo-v2.5-asr",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: Buffer.from("wav-bytes").toString("base64"),
                format: "wav",
              },
            },
          ],
        },
      ],
      asr_options: { language: "zh" },
    });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(body.messages[0].content).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text" })]),
    );
  });

  it("allows browser fallback and avoids a false audio-format claim on MiMo 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { message: "Unsupported model mimo-v2.5-asr" } },
          { status: 400 },
        ),
      ),
    );

    const response = await POST(buildAudioRequest());
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.canFallback).toBe(true);
    expect(json.data.message).toBe(
      "云端语音识别暂不可用，可改用浏览器语音或手动输入。",
    );
    expect(json.data.message).not.toContain("音频格式");
  });
});
